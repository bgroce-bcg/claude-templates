const Database = require('better-sqlite3');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Monitors a single CADI project
 * - Reads from project.db (read-only)
 * - Watches .claude/, docs/plans/, docs/features/ for changes
 * - Emits events when things change
 */
class ProjectMonitor extends EventEmitter {
  constructor(projectConfig) {
    super();

    this.id = projectConfig.id;
    this.name = projectConfig.name;
    this.path = projectConfig.path;
    this.color = projectConfig.color || '#3178C6';
    this.enabled = projectConfig.enabled !== false;

    this.dbPath = path.join(this.path, '.claude/project.db');
    this.db = null;
    this.watcher = null;
    this.lastStats = null;
    this.pollInterval = null;
  }

  /**
   * Initialize the monitor
   */
  async init() {
    if (!this.enabled) {
      return;
    }

    // Check if project directory exists
    if (!fs.existsSync(this.path)) {
      throw new Error(`Project path does not exist: ${this.path}`);
    }

    // Check if .claude/project.db exists
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database not found: ${this.dbPath}`);
    }

    // Open database in read-only mode
    try {
      this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });

      // Verify database has expected tables
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = tables.map(t => t.name);

      if (!tableNames.includes('features') || !tableNames.includes('sections')) {
        throw new Error(`Database missing required tables: ${this.dbPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to open database: ${error.message}`);
    }

    // Set up file watchers
    const watchPaths = [
      path.join(this.path, '.claude'),
      path.join(this.path, 'docs/plans'),
      path.join(this.path, 'docs/features')
    ].filter(p => fs.existsSync(p));

    if (watchPaths.length > 0) {
      this.watcher = chokidar.watch(watchPaths, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        }
      });

      this.watcher
        .on('change', (filepath) => this.onFileChange('change', filepath))
        .on('add', (filepath) => this.onFileChange('add', filepath))
        .on('unlink', (filepath) => this.onFileChange('unlink', filepath));
    }

    // Get initial stats
    this.lastStats = this.getStats();

    // Set up periodic polling to catch database changes
    // even if file system events don't fire
    this.pollInterval = setInterval(() => {
      this.checkForChanges();
    }, 3000); // Poll every 3 seconds

    this.emit('initialized', { projectId: this.id, name: this.name });
  }

  /**
   * Periodically check for database changes
   */
  checkForChanges() {
    if (!this.db) return;

    try {
      // Reopen database to get fresh data
      this.reopenDatabase();

      const newStats = this.getStats();
      if (JSON.stringify(newStats) !== JSON.stringify(this.lastStats)) {
        this.emit('statsChanged', {
          projectId: this.id,
          projectName: this.name,
          oldStats: this.lastStats,
          newStats: newStats,
          timestamp: new Date().toISOString()
        });
        this.lastStats = newStats;
      }
    } catch (error) {
      console.error(`Error checking for changes in ${this.id}:`, error.message);
    }
  }

  /**
   * Handle file changes
   */
  onFileChange(eventType, filepath) {
    const relativePath = path.relative(this.path, filepath);

    this.emit('fileChange', {
      projectId: this.id,
      projectName: this.name,
      eventType,
      file: relativePath,
      timestamp: new Date().toISOString()
    });

    // Check if stats changed (e.g., database was updated)
    if (filepath.endsWith('project.db')) {
      // Close and reopen database to get fresh data
      this.reopenDatabase();

      const newStats = this.getStats();
      if (JSON.stringify(newStats) !== JSON.stringify(this.lastStats)) {
        this.emit('statsChanged', {
          projectId: this.id,
          projectName: this.name,
          oldStats: this.lastStats,
          newStats: newStats,
          timestamp: new Date().toISOString()
        });
        this.lastStats = newStats;
      }
    }
  }

  /**
   * Reopen database connection (to get fresh data after changes)
   */
  reopenDatabase() {
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        // Ignore errors on close
      }
    }

    try {
      this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
    } catch (error) {
      console.error(`Failed to reopen database for ${this.id}:`, error.message);
    }
  }

  /**
   * Get overall project statistics
   */
  getStats() {
    if (!this.db) return null;

    try {
      // Feature counts by status
      const featureStats = this.db.prepare(`
        SELECT
          status,
          COUNT(*) as count
        FROM features
        GROUP BY status
      `).all();

      // Section counts by status
      const sectionStats = this.db.prepare(`
        SELECT
          status,
          COUNT(*) as count
        FROM sections
        GROUP BY status
      `).all();

      // Total features
      const totalFeatures = this.db.prepare('SELECT COUNT(*) as count FROM features').get();

      // Total sections
      const totalSections = this.db.prepare('SELECT COUNT(*) as count FROM sections').get();

      // Context documents count (if table exists)
      let contextDocsCount = 0;
      try {
        const docsCount = this.db.prepare('SELECT COUNT(*) as count FROM context_documents').get();
        contextDocsCount = docsCount.count;
      } catch (error) {
        // Table might not exist in older databases
      }

      return {
        features: {
          total: totalFeatures.count,
          byStatus: featureStats.reduce((acc, row) => {
            acc[row.status] = row.count;
            return acc;
          }, {})
        },
        sections: {
          total: totalSections.count,
          byStatus: sectionStats.reduce((acc, row) => {
            acc[row.status] = row.count;
            return acc;
          }, {})
        },
        contextDocs: contextDocsCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error getting stats for ${this.id}:`, error.message);
      return null;
    }
  }

  /**
   * Get all features
   */
  getFeatures() {
    if (!this.db) return [];

    try {
      return this.db.prepare(`
        SELECT
          id,
          name,
          summary,
          status,
          priority,
          created_at,
          started_at,
          completed_at
        FROM features
        ORDER BY priority DESC, created_at DESC
      `).all();
    } catch (error) {
      console.error(`Error getting features for ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Get sections for a feature
   */
  getSections(featureId) {
    if (!this.db) return [];

    try {
      return this.db.prepare(`
        SELECT
          id,
          feature_id,
          name,
          description,
          objectives,
          verification_criteria,
          order_index,
          status,
          depends_on,
          estimated_hours,
          actual_hours,
          started_at,
          completed_at,
          notes
        FROM sections
        WHERE feature_id = ?
        ORDER BY order_index ASC
      `).all(featureId);
    } catch (error) {
      console.error(`Error getting sections for feature ${featureId} in ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Get recent activity (requires activity tracking table - future enhancement)
   */
  getRecentActivity(limit = 10) {
    // This would require an activity_log table in the database
    // For now, return empty array
    // TODO: Implement when activity logging is added to CADI
    return [];
  }

  /**
   * Get agent invocations
   */
  getAgentInvocations(options = {}) {
    if (!this.db) return [];

    try {
      // Check if table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_invocations'"
      ).get();

      if (!tableExists) {
        return [];
      }

      const {
        limit = 50,
        agentType = null,
        sessionId = null,
        featureId = null,
        parentAgent = null
      } = options;

      let query = `
        SELECT
          i.id,
          i.agent_type,
          i.agent_prompt,
          i.agent_description,
          i.session_id,
          i.parent_agent,
          i.feature_id,
          i.section_id,
          i.invoked_at,
          c.completed_at,
          c.duration_ms,
          c.success,
          c.error_message,
          f.name as feature_name,
          s.name as section_name
        FROM agent_invocations i
        LEFT JOIN agent_completions c ON i.id = c.invocation_id
        LEFT JOIN features f ON i.feature_id = f.id
        LEFT JOIN sections s ON i.section_id = s.id
        WHERE 1=1
      `;

      const params = [];

      if (agentType) {
        query += ' AND i.agent_type = ?';
        params.push(agentType);
      }

      if (sessionId) {
        query += ' AND i.session_id = ?';
        params.push(sessionId);
      }

      if (featureId) {
        query += ' AND i.feature_id = ?';
        params.push(featureId);
      }

      if (parentAgent) {
        query += ' AND i.parent_agent = ?';
        params.push(parentAgent);
      }

      query += ' ORDER BY i.invoked_at DESC LIMIT ?';
      params.push(limit);

      return this.db.prepare(query).all(...params);
    } catch (error) {
      console.error(`Error getting agent invocations for ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Get agent invocation statistics
   */
  getAgentStats() {
    if (!this.db) return null;

    try {
      // Check if table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_invocations'"
      ).get();

      if (!tableExists) {
        return {
          total: 0,
          byType: {},
          completed: 0,
          inProgress: 0,
          avgDuration: 0,
          totalDuration: 0
        };
      }

      // Total invocations
      const total = this.db.prepare('SELECT COUNT(*) as count FROM agent_invocations').get();

      // By agent type
      const byType = this.db.prepare(`
        SELECT
          i.agent_type,
          COUNT(*) as count,
          AVG(c.duration_ms) as avg_duration,
          MIN(c.duration_ms) as min_duration,
          MAX(c.duration_ms) as max_duration
        FROM agent_invocations i
        LEFT JOIN agent_completions c ON i.id = c.invocation_id
        GROUP BY i.agent_type
        ORDER BY count DESC
      `).all();

      // Completed vs in progress
      const completedCount = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM agent_invocations i
        INNER JOIN agent_completions c ON i.id = c.invocation_id
      `).get();

      // Duration stats
      const durationStats = this.db.prepare(`
        SELECT
          AVG(duration_ms) as avg_duration,
          SUM(duration_ms) as total_duration
        FROM agent_completions
        WHERE duration_ms IS NOT NULL
      `).get();

      return {
        total: total.count,
        byType: byType.reduce((acc, row) => {
          acc[row.agent_type] = {
            count: row.count,
            avgDuration: Math.round(row.avg_duration || 0),
            minDuration: row.min_duration || 0,
            maxDuration: row.max_duration || 0
          };
          return acc;
        }, {}),
        completed: completedCount.count,
        inProgress: total.count - completedCount.count,
        avgDuration: Math.round(durationStats.avg_duration || 0),
        totalDuration: Math.round(durationStats.total_duration || 0)
      };
    } catch (error) {
      console.error(`Error getting agent stats for ${this.id}:`, error.message);
      return null;
    }
  }

  /**
   * Get error log entries
   */
  getErrors(options = {}) {
    if (!this.db) return [];

    try {
      // Check if table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='error_log'"
      ).get();

      if (!tableExists) {
        return [];
      }

      const {
        limit = 50,
        severity = null,
        resolved = null,
        agentName = null,
        featureId = null
      } = options;

      let query = `
        SELECT
          e.id,
          e.timestamp,
          e.agent_name,
          e.command_name,
          e.feature_id,
          e.section_id,
          e.error_type,
          e.error_message,
          e.error_context,
          e.resolution,
          e.severity,
          e.resolved,
          f.name as feature_name,
          s.name as section_name
        FROM error_log e
        LEFT JOIN features f ON e.feature_id = f.id
        LEFT JOIN sections s ON e.section_id = s.id
        WHERE 1=1
      `;

      const params = [];

      if (severity) {
        query += ' AND e.severity = ?';
        params.push(severity);
      }

      if (resolved !== null) {
        query += ' AND e.resolved = ?';
        params.push(resolved ? 1 : 0);
      }

      if (agentName) {
        query += ' AND e.agent_name = ?';
        params.push(agentName);
      }

      if (featureId) {
        query += ' AND e.feature_id = ?';
        params.push(featureId);
      }

      query += ' ORDER BY e.timestamp DESC LIMIT ?';
      params.push(limit);

      return this.db.prepare(query).all(...params);
    } catch (error) {
      console.error(`Error getting errors for ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    if (!this.db) return null;

    try {
      // Check if table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='error_log'"
      ).get();

      if (!tableExists) {
        return {
          total: 0,
          bySeverity: {},
          byAgent: {},
          resolved: 0,
          unresolved: 0
        };
      }

      // Total errors
      const total = this.db.prepare('SELECT COUNT(*) as count FROM error_log').get();

      // By severity
      const bySeverity = this.db.prepare(`
        SELECT severity, COUNT(*) as count
        FROM error_log
        GROUP BY severity
      `).all();

      // By agent
      const byAgent = this.db.prepare(`
        SELECT agent_name, COUNT(*) as count
        FROM error_log
        GROUP BY agent_name
        ORDER BY count DESC
        LIMIT 10
      `).all();

      // Resolved vs unresolved
      const resolvedCount = this.db.prepare(
        'SELECT COUNT(*) as count FROM error_log WHERE resolved = 1'
      ).get();

      return {
        total: total.count,
        bySeverity: bySeverity.reduce((acc, row) => {
          acc[row.severity] = row.count;
          return acc;
        }, {}),
        byAgent: byAgent.reduce((acc, row) => {
          acc[row.agent_name] = row.count;
          return acc;
        }, {}),
        resolved: resolvedCount.count,
        unresolved: total.count - resolvedCount.count
      };
    } catch (error) {
      console.error(`Error getting error stats for ${this.id}:`, error.message);
      return null;
    }
  }

  /**
   * Get context documents
   */
  getContextDocuments() {
    if (!this.db) return [];

    try {
      // Check if table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='context_documents'"
      ).get();

      if (!tableExists) {
        return [];
      }

      return this.db.prepare(`
        SELECT
          id,
          file_path,
          title,
          category,
          summary,
          tags,
          feature_id,
          estimated_tokens,
          last_indexed,
          file_modified
        FROM context_documents
        ORDER BY last_indexed DESC
      `).all();
    } catch (error) {
      console.error(`Error getting context documents for ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Get context loads
   */
  getContextLoads(options = {}) {
    if (!this.db) return [];

    try {
      // Check if table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='context_loads'"
      ).get();

      if (!tableExists) {
        return [];
      }

      const {
        limit = 50,
        agentName = null,
        featureId = null,
        sectionId = null
      } = options;

      let query = `
        SELECT
          cl.id,
          cl.timestamp,
          cl.agent_name,
          cl.feature_id,
          cl.section_id,
          cl.request,
          cl.category,
          cl.tags,
          cl.document_ids,
          cl.document_count,
          cl.total_tokens,
          cl.duration_ms,
          f.name as feature_name,
          s.name as section_name
        FROM context_loads cl
        LEFT JOIN features f ON cl.feature_id = f.id
        LEFT JOIN sections s ON cl.section_id = s.id
        WHERE 1=1
      `;

      const params = [];

      if (agentName) {
        query += ' AND cl.agent_name = ?';
        params.push(agentName);
      }

      if (featureId) {
        query += ' AND cl.feature_id = ?';
        params.push(featureId);
      }

      if (sectionId) {
        query += ' AND cl.section_id = ?';
        params.push(sectionId);
      }

      query += ' ORDER BY cl.timestamp DESC LIMIT ?';
      params.push(limit);

      return this.db.prepare(query).all(...params);
    } catch (error) {
      console.error(`Error getting context loads for ${this.id}:`, error.message);
      return [];
    }
  }

  /**
   * Get context load statistics
   */
  getContextLoadStats() {
    if (!this.db) return null;

    try {
      // Check if table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='context_loads'"
      ).get();

      if (!tableExists) {
        return {
          total: 0,
          byAgent: {},
          byCategory: {},
          totalDocuments: 0,
          totalTokens: 0,
          avgDuration: 0
        };
      }

      // Total loads
      const total = this.db.prepare('SELECT COUNT(*) as count FROM context_loads').get();

      // By agent
      const byAgent = this.db.prepare(`
        SELECT agent_name, COUNT(*) as count
        FROM context_loads
        GROUP BY agent_name
        ORDER BY count DESC
      `).all();

      // By category
      const byCategory = this.db.prepare(`
        SELECT category, COUNT(*) as count
        FROM context_loads
        WHERE category IS NOT NULL
        GROUP BY category
      `).all();

      // Totals and averages
      const totals = this.db.prepare(`
        SELECT
          SUM(document_count) as total_documents,
          SUM(total_tokens) as total_tokens,
          AVG(duration_ms) as avg_duration
        FROM context_loads
      `).get();

      return {
        total: total.count,
        byAgent: byAgent.reduce((acc, row) => {
          acc[row.agent_name] = row.count;
          return acc;
        }, {}),
        byCategory: byCategory.reduce((acc, row) => {
          acc[row.category] = row.count;
          return acc;
        }, {}),
        totalDocuments: totals.total_documents || 0,
        totalTokens: totals.total_tokens || 0,
        avgDuration: Math.round(totals.avg_duration || 0)
      };
    } catch (error) {
      console.error(`Error getting context load stats for ${this.id}:`, error.message);
      return null;
    }
  }

  /**
   * Get health status
   */
  getHealth() {
    const health = {
      projectId: this.id,
      name: this.name,
      path: this.path,
      status: 'healthy',
      issues: []
    };

    // Check if directory exists
    if (!fs.existsSync(this.path)) {
      health.status = 'error';
      health.issues.push('Project directory not found');
      return health;
    }

    // Check if database exists
    if (!fs.existsSync(this.dbPath)) {
      health.status = 'error';
      health.issues.push('Database not found');
      return health;
    }

    // Check if database is readable
    if (!this.db) {
      health.status = 'error';
      health.issues.push('Database not connected');
      return health;
    }

    // Check database integrity
    try {
      const integrityCheck = this.db.prepare('PRAGMA integrity_check').get();
      if (integrityCheck.integrity_check !== 'ok') {
        health.status = 'warning';
        health.issues.push(`Database integrity: ${integrityCheck.integrity_check}`);
      }
    } catch (error) {
      health.status = 'warning';
      health.issues.push(`Database integrity check failed: ${error.message}`);
    }

    return health;
  }

  /**
   * Close the monitor
   */
  async close() {
    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.emit('closed', { projectId: this.id });
  }
}

module.exports = ProjectMonitor;
