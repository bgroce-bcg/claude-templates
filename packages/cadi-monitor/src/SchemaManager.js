const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * Manages database schema validation and migrations
 * Ensures project databases have the correct structure
 */
class SchemaManager {
  constructor() {
    // Define the expected schema with version
    this.schemaVersion = 7; // Increment when schema changes

    this.expectedSchema = {
      version: this.schemaVersion,
      tables: {
        features: {
          columns: [
            'id INTEGER PRIMARY KEY AUTOINCREMENT',
            'name TEXT NOT NULL UNIQUE',
            'planning_doc_path TEXT NOT NULL',
            'summary TEXT',
            'status TEXT CHECK(status IN (\'planning\', \'ready\', \'in_progress\', \'testing\', \'completed\'))',
            'priority INTEGER DEFAULT 0',
            'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'started_at TIMESTAMP',
            'completed_at TIMESTAMP'
          ],
          indexes: []
        },
        sections: {
          columns: [
            'id INTEGER PRIMARY KEY AUTOINCREMENT',
            'feature_id INTEGER NOT NULL',
            'name TEXT NOT NULL',
            'description TEXT',
            'objectives TEXT',
            'verification_criteria TEXT',
            'order_index INTEGER NOT NULL',
            'status TEXT CHECK(status IN (\'pending\', \'in_progress\', \'completed\'))',
            'depends_on INTEGER',
            'estimated_hours REAL',
            'actual_hours REAL',
            'started_at TIMESTAMP',
            'completed_at TIMESTAMP',
            'notes TEXT',
            'FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE',
            'FOREIGN KEY (depends_on) REFERENCES sections(id)'
          ],
          indexes: [
            'CREATE INDEX IF NOT EXISTS idx_sections_feature_status ON sections(feature_id, status)',
            'CREATE INDEX IF NOT EXISTS idx_sections_order ON sections(feature_id, order_index)'
          ]
        },
        context_documents: {
          columns: [
            'id INTEGER PRIMARY KEY AUTOINCREMENT',
            'file_path TEXT NOT NULL UNIQUE',
            'title TEXT NOT NULL',
            'category TEXT NOT NULL',
            'summary TEXT',
            'tags TEXT',
            'feature_id INTEGER',
            'estimated_tokens INTEGER',
            'last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'file_modified TIMESTAMP',
            'FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE'
          ],
          indexes: [
            'CREATE INDEX IF NOT EXISTS idx_docs_category ON context_documents(category)',
            'CREATE INDEX IF NOT EXISTS idx_docs_feature ON context_documents(feature_id)'
          ]
        },
        error_log: {
          columns: [
            'id INTEGER PRIMARY KEY AUTOINCREMENT',
            'timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'agent_name TEXT NOT NULL',
            'command_name TEXT',
            'feature_id INTEGER',
            'section_id INTEGER',
            'error_type TEXT NOT NULL',
            'error_message TEXT NOT NULL',
            'error_context TEXT',
            'severity TEXT CHECK(severity IN (\'low\', \'medium\', \'high\', \'critical\')) DEFAULT \'medium\'',
            'resolved BOOLEAN DEFAULT 0',
            'resolution TEXT',
            'resolved_at TIMESTAMP',
            'FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE',
            'FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE'
          ],
          indexes: [
            'CREATE INDEX IF NOT EXISTS idx_error_log_timestamp ON error_log(timestamp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_error_log_feature ON error_log(feature_id)',
            'CREATE INDEX IF NOT EXISTS idx_error_log_severity ON error_log(severity)',
            'CREATE INDEX IF NOT EXISTS idx_error_log_resolved ON error_log(resolved)'
          ]
        },
        context_loads: {
          columns: [
            'id INTEGER PRIMARY KEY AUTOINCREMENT',
            'timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            'agent_name TEXT NOT NULL',
            'feature_id INTEGER',
            'section_id INTEGER',
            'request TEXT NOT NULL',
            'category TEXT',
            'tags TEXT',
            'document_ids TEXT',
            'document_count INTEGER NOT NULL',
            'total_tokens INTEGER',
            'duration_ms INTEGER',
            'FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE',
            'FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE'
          ],
          indexes: [
            'CREATE INDEX IF NOT EXISTS idx_context_loads_timestamp ON context_loads(timestamp DESC)',
            'CREATE INDEX IF NOT EXISTS idx_context_loads_agent ON context_loads(agent_name)',
            'CREATE INDEX IF NOT EXISTS idx_context_loads_feature ON context_loads(feature_id)',
            'CREATE INDEX IF NOT EXISTS idx_context_loads_section ON context_loads(section_id)'
          ]
        },
        schema_version: {
          columns: [
            'version INTEGER NOT NULL',
            'applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
          ],
          indexes: []
        },
        agent_invocations: {
          columns: [
            'id INTEGER PRIMARY KEY AUTOINCREMENT',
            'agent_type TEXT NOT NULL',
            'agent_prompt TEXT NOT NULL',
            'agent_description TEXT',
            'session_id TEXT NOT NULL',
            'parent_agent TEXT',
            'feature_id INTEGER',
            'section_id INTEGER',
            'tool_name TEXT DEFAULT \'Task\'',
            'tool_input TEXT',
            'invoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE',
            'FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE'
          ],
          indexes: [
            'CREATE INDEX IF NOT EXISTS idx_agent_invocations_session ON agent_invocations(session_id)',
            'CREATE INDEX IF NOT EXISTS idx_agent_invocations_type ON agent_invocations(agent_type)',
            'CREATE INDEX IF NOT EXISTS idx_agent_invocations_invoked_at ON agent_invocations(invoked_at DESC)',
            'CREATE INDEX IF NOT EXISTS idx_agent_invocations_feature ON agent_invocations(feature_id)'
          ]
        },
        agent_completions: {
          columns: [
            'id INTEGER PRIMARY KEY AUTOINCREMENT',
            'invocation_id INTEGER NOT NULL',
            'session_id TEXT NOT NULL',
            'completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
            'duration_ms INTEGER',
            'tool_response TEXT',
            'success BOOLEAN DEFAULT 1',
            'error_message TEXT',
            'FOREIGN KEY (invocation_id) REFERENCES agent_invocations(id) ON DELETE CASCADE'
          ],
          indexes: [
            'CREATE INDEX IF NOT EXISTS idx_agent_completions_invocation ON agent_completions(invocation_id)',
            'CREATE INDEX IF NOT EXISTS idx_agent_completions_session ON agent_completions(session_id)',
            'CREATE INDEX IF NOT EXISTS idx_agent_completions_completed_at ON agent_completions(completed_at DESC)'
          ]
        }
      }
    };

    // Define migrations
    this.migrations = [
      {
        version: 1,
        description: 'Initial schema with features and sections',
        up: (db) => {
          // Base tables - assumed to already exist
        }
      },
      {
        version: 2,
        description: 'Add context_documents table',
        up: (db) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS context_documents (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_path TEXT NOT NULL UNIQUE,
              title TEXT NOT NULL,
              category TEXT NOT NULL,
              summary TEXT,
              tags TEXT,
              feature_id INTEGER,
              estimated_tokens INTEGER,
              last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              file_modified TIMESTAMP,
              FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_docs_category ON context_documents(category);
            CREATE INDEX IF NOT EXISTS idx_docs_feature ON context_documents(feature_id);
          `);
        }
      },
      {
        version: 3,
        description: 'Add error_log table and resolved_at column',
        up: (db) => {
          // Check if error_log table exists
          const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='error_log'").get();

          if (tableExists) {
            // Table exists, check if resolved_at column exists
            const columns = db.prepare('PRAGMA table_info(error_log)').all();
            const hasResolvedAt = columns.some(col => col.name === 'resolved_at');

            if (!hasResolvedAt) {
              // Add missing column
              db.exec('ALTER TABLE error_log ADD COLUMN resolved_at TIMESTAMP;');
            }
          } else {
            // Create table from scratch
            db.exec(`
              CREATE TABLE error_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                agent_name TEXT NOT NULL,
                command_name TEXT,
                feature_id INTEGER,
                section_id INTEGER,
                error_type TEXT NOT NULL,
                error_message TEXT NOT NULL,
                error_context TEXT,
                severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
                resolved BOOLEAN DEFAULT 0,
                resolution TEXT,
                resolved_at TIMESTAMP,
                FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
                FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
              );
            `);
          }

          // Create indexes
          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_error_log_timestamp ON error_log(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_error_log_feature ON error_log(feature_id);
            CREATE INDEX IF NOT EXISTS idx_error_log_severity ON error_log(severity);
            CREATE INDEX IF NOT EXISTS idx_error_log_resolved ON error_log(resolved);
          `);
        }
      },
      {
        version: 4,
        description: 'Add resolved_at column to error_log (fix for existing tables)',
        up: (db) => {
          // Check if resolved_at column exists
          const columns = db.prepare('PRAGMA table_info(error_log)').all();
          const hasResolvedAt = columns.some(col => col.name === 'resolved_at');

          if (!hasResolvedAt) {
            // Add missing column
            db.exec('ALTER TABLE error_log ADD COLUMN resolved_at TIMESTAMP;');
          }
        }
      },
      {
        version: 5,
        description: 'Add context_loads table for monitoring agent context',
        up: (db) => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS context_loads (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              agent_name TEXT NOT NULL,
              feature_id INTEGER,
              section_id INTEGER,
              request TEXT NOT NULL,
              category TEXT,
              tags TEXT,
              document_ids TEXT,
              document_count INTEGER NOT NULL,
              total_tokens INTEGER,
              duration_ms INTEGER,
              FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
              FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_context_loads_timestamp ON context_loads(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_context_loads_agent ON context_loads(agent_name);
            CREATE INDEX IF NOT EXISTS idx_context_loads_feature ON context_loads(feature_id);
            CREATE INDEX IF NOT EXISTS idx_context_loads_section ON context_loads(section_id);
          `);
        }
      },
      {
        version: 6,
        description: 'Add agent invocation and completion tracking',
        up: (db) => {
          db.exec(`
            -- Table to track agent invocations (when Task tool is called)
            CREATE TABLE IF NOT EXISTS agent_invocations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              agent_type TEXT NOT NULL,
              agent_prompt TEXT NOT NULL,
              agent_description TEXT,
              session_id TEXT NOT NULL,
              parent_agent TEXT,
              feature_id INTEGER,
              section_id INTEGER,
              tool_name TEXT DEFAULT 'Task',
              tool_input TEXT,
              invoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
              FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
            );

            -- Table to track agent completions
            CREATE TABLE IF NOT EXISTS agent_completions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              invocation_id INTEGER NOT NULL,
              session_id TEXT NOT NULL,
              completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              duration_ms INTEGER,
              tool_response TEXT,
              success BOOLEAN DEFAULT 1,
              error_message TEXT,
              FOREIGN KEY (invocation_id) REFERENCES agent_invocations(id) ON DELETE CASCADE
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_agent_invocations_session ON agent_invocations(session_id);
            CREATE INDEX IF NOT EXISTS idx_agent_invocations_type ON agent_invocations(agent_type);
            CREATE INDEX IF NOT EXISTS idx_agent_invocations_invoked_at ON agent_invocations(invoked_at DESC);
            CREATE INDEX IF NOT EXISTS idx_agent_invocations_feature ON agent_invocations(feature_id);
            CREATE INDEX IF NOT EXISTS idx_agent_completions_invocation ON agent_completions(invocation_id);
            CREATE INDEX IF NOT EXISTS idx_agent_completions_session ON agent_completions(session_id);
            CREATE INDEX IF NOT EXISTS idx_agent_completions_completed_at ON agent_completions(completed_at DESC);

            -- View for easy querying of agent activity with timing
            CREATE VIEW IF NOT EXISTS agent_activity AS
            SELECT
              i.id as invocation_id,
              i.agent_type,
              i.agent_description,
              i.parent_agent,
              i.session_id,
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
            ORDER BY i.invoked_at DESC;
          `);
        }
      },
      {
        version: 7,
        description: 'Add testing status to features',
        up: (db) => {
          // SQLite doesn't support ALTER TABLE to modify CHECK constraints
          // We need to recreate the table with the new constraint
          db.exec(`
            -- Drop dependent view first
            DROP VIEW IF EXISTS agent_activity;

            -- Create temporary table with new schema
            CREATE TABLE features_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              planning_doc_path TEXT NOT NULL,
              summary TEXT,
              status TEXT CHECK(status IN ('planning', 'ready', 'in_progress', 'testing', 'completed')) DEFAULT 'planning',
              priority INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              started_at TIMESTAMP,
              completed_at TIMESTAMP
            );

            -- Copy data from old table
            INSERT INTO features_new SELECT * FROM features;

            -- Drop old table
            DROP TABLE features;

            -- Rename new table
            ALTER TABLE features_new RENAME TO features;

            -- Recreate the view
            CREATE VIEW IF NOT EXISTS agent_activity AS
            SELECT
              i.id as invocation_id,
              i.agent_type,
              i.agent_description,
              i.parent_agent,
              i.session_id,
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
            ORDER BY i.invoked_at DESC;
          `);
        }
      }
    ];
  }

  /**
   * Check database schema and identify missing tables/columns
   */
  checkSchema(dbPath) {
    if (!fs.existsSync(dbPath)) {
      return {
        valid: false,
        currentVersion: 0,
        expectedVersion: this.schemaVersion,
        errors: ['Database file does not exist'],
        missingTables: Object.keys(this.expectedSchema.tables),
        needsMigration: true
      };
    }

    const db = new Database(dbPath, { readonly: true });
    const result = {
      valid: true,
      currentVersion: this.getCurrentVersion(db),
      expectedVersion: this.schemaVersion,
      errors: [],
      missingTables: [],
      missingColumns: {},
      needsMigration: false
    };

    try {
      // Get existing tables
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const existingTables = tables.map(t => t.name);

      // Check for missing tables
      for (const tableName of Object.keys(this.expectedSchema.tables)) {
        if (!existingTables.includes(tableName)) {
          result.missingTables.push(tableName);
          result.valid = false;
          result.needsMigration = true;
        } else {
          // Check columns for existing tables
          const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
          const existingColumns = tableInfo.map(col => col.name);

          const expectedColumns = this.expectedSchema.tables[tableName].columns
            .map(col => col.split(' ')[0])
            .filter(name => !['FOREIGN', 'PRIMARY', 'CHECK'].includes(name));

          const missing = expectedColumns.filter(col => !existingColumns.includes(col));
          if (missing.length > 0) {
            result.missingColumns[tableName] = missing;
            result.valid = false;
            result.needsMigration = true;
          }
        }
      }

      // Check version
      if (result.currentVersion < this.schemaVersion) {
        result.needsMigration = true;
        result.valid = false;
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(error.message);
    } finally {
      db.close();
    }

    return result;
  }

  /**
   * Get current schema version from database
   */
  getCurrentVersion(db) {
    try {
      // Check if schema_version table exists
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'").get();

      if (!tables) {
        // No version table = version 1 (base schema)
        return 1;
      }

      const versionRow = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get();
      return versionRow ? versionRow.version : 1;
    } catch (error) {
      return 1; // Assume version 1 if we can't read
    }
  }

  /**
   * Apply migrations to bring database up to current version
   */
  async migrateSchema(dbPath) {
    if (!fs.existsSync(dbPath)) {
      return {
        success: false,
        error: 'Database file does not exist'
      };
    }

    const db = new Database(dbPath);
    const result = {
      success: true,
      appliedMigrations: [],
      errors: []
    };

    try {
      // Get current version
      const currentVersion = this.getCurrentVersion(db);

      // Create schema_version table if it doesn't exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // If no version recorded, record the current state
      if (currentVersion === 1) {
        const hasVersionRecord = db.prepare('SELECT COUNT(*) as count FROM schema_version').get();
        if (hasVersionRecord.count === 0) {
          db.prepare('INSERT INTO schema_version (version) VALUES (1)').run();
        }
      }

      // Apply migrations in order
      for (const migration of this.migrations) {
        if (migration.version > currentVersion) {
          try {
            console.log(`Applying migration ${migration.version}: ${migration.description}`);

            // Execute migration
            migration.up(db);

            // Record migration
            db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);

            result.appliedMigrations.push({
              version: migration.version,
              description: migration.description
            });
          } catch (error) {
            result.errors.push({
              version: migration.version,
              error: error.message
            });
            result.success = false;
            break; // Stop on first error
          }
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push({ error: error.message });
    } finally {
      db.close();
    }

    return result;
  }

  /**
   * Get migration plan (what would be applied)
   */
  getMigrationPlan(dbPath) {
    const db = new Database(dbPath, { readonly: true });

    try {
      const currentVersion = this.getCurrentVersion(db);
      const pending = this.migrations.filter(m => m.version > currentVersion);

      return {
        currentVersion,
        targetVersion: this.schemaVersion,
        pendingMigrations: pending.map(m => ({
          version: m.version,
          description: m.description
        }))
      };
    } finally {
      db.close();
    }
  }

  /**
   * Generate SQL for all migrations (for reference)
   */
  generateFullSchema() {
    const sql = [];

    // Generate CREATE TABLE statements
    for (const [tableName, tableDef] of Object.entries(this.expectedSchema.tables)) {
      sql.push(`CREATE TABLE IF NOT EXISTS ${tableName} (`);
      sql.push('  ' + tableDef.columns.join(',\n  '));
      sql.push(');');
      sql.push('');

      // Add indexes
      for (const index of tableDef.indexes) {
        sql.push(index + ';');
      }
      sql.push('');
    }

    return sql.join('\n');
  }
}

module.exports = SchemaManager;
