const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const SchemaManager = require('./SchemaManager');

/**
 * Manages safe updates to CADI projects
 * - Detects changes between template and project
 * - Creates backups before updating
 * - Preserves custom files
 * - Allows rollback on failure
 */
class UpdateManager extends EventEmitter {
  constructor(templatePath) {
    super();

    // Path to base-claude template (e.g., /home/user/claude-templates/base-claude)
    this.templatePath = templatePath;
    this.backupDir = '.claude-backup';
    this.schemaManager = new SchemaManager();
  }

  /**
   * Analyze what would change if we updated a project
   */
  async analyzeUpdates(projectPath) {
    const analysis = {
      projectPath,
      timestamp: new Date().toISOString(),
      changes: {
        added: [],      // New files from template
        modified: [],   // Files that exist but differ
        unchanged: [],  // Files that are identical
        custom: []      // Custom files not in template
      },
      schema: null,     // Database schema status
      safe: true,
      errors: []
    };

    try {
      const projectClaudeDir = path.join(projectPath, '.claude');
      const templateClaudeDir = path.join(this.templatePath, 'agents');
      const templateCommandsDir = path.join(this.templatePath, 'commands');

      // Check if project has .claude directory
      if (!fs.existsSync(projectClaudeDir)) {
        analysis.safe = false;
        analysis.errors.push('Project does not have .claude directory');
        return analysis;
      }

      // Analyze agents
      if (fs.existsSync(templateClaudeDir)) {
        this.analyzeDirectory(
          templateClaudeDir,
          path.join(projectClaudeDir, 'agents'),
          'agents',
          analysis
        );
      }

      // Analyze commands
      if (fs.existsSync(templateCommandsDir)) {
        this.analyzeDirectory(
          templateCommandsDir,
          path.join(projectClaudeDir, 'commands'),
          'commands',
          analysis
        );
      }

      // Find custom files in project that aren't in template
      this.findCustomFiles(
        path.join(projectClaudeDir, 'agents'),
        templateClaudeDir,
        'agents',
        analysis
      );

      this.findCustomFiles(
        path.join(projectClaudeDir, 'commands'),
        templateCommandsDir,
        'commands',
        analysis
      );

      // Check database schema
      const dbPath = path.join(projectClaudeDir, 'project.db');
      if (fs.existsSync(dbPath)) {
        try {
          analysis.schema = this.schemaManager.checkSchema(dbPath);

          // Schema needing migration is not an error - it will be handled during update
          // Just store the schema status for the UI to display
        } catch (error) {
          analysis.safe = false;
          analysis.errors.push(`Schema check failed: ${error.message}`);
        }
      } else {
        // Database not found is a warning but not critical
        analysis.schema = { valid: false, errors: ['Database file not found'] };
      }

    } catch (error) {
      analysis.safe = false;
      analysis.errors.push(error.message);
    }

    return analysis;
  }

  /**
   * Recursively analyze a directory
   */
  analyzeDirectory(templateDir, projectDir, relativePath, analysis) {
    if (!fs.existsSync(templateDir)) return;

    const entries = fs.readdirSync(templateDir, { withFileTypes: true });

    for (const entry of entries) {
      const templatePath = path.join(templateDir, entry.name);
      const projectPath = path.join(projectDir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        this.analyzeDirectory(templatePath, projectPath, relPath, analysis);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Compare files
        if (!fs.existsSync(projectPath)) {
          // New file
          analysis.changes.added.push({
            path: relPath,
            type: 'file'
          });
        } else {
          // Check if modified
          const templateContent = fs.readFileSync(templatePath, 'utf8');
          const projectContent = fs.readFileSync(projectPath, 'utf8');

          if (templateContent !== projectContent) {
            analysis.changes.modified.push({
              path: relPath,
              type: 'file',
              templateSize: templateContent.length,
              projectSize: projectContent.length
            });
          } else {
            analysis.changes.unchanged.push({
              path: relPath,
              type: 'file'
            });
          }
        }
      }
    }
  }

  /**
   * Find custom files in project that aren't in template
   */
  findCustomFiles(projectDir, templateDir, relativePath, analysis) {
    if (!fs.existsSync(projectDir)) return;

    const entries = fs.readdirSync(projectDir, { withFileTypes: true });

    for (const entry of entries) {
      const projectPath = path.join(projectDir, entry.name);
      const templatePath = path.join(templateDir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        this.findCustomFiles(
          projectPath,
          templatePath,
          relPath,
          analysis
        );
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Check if file exists in template
        if (!fs.existsSync(templatePath)) {
          analysis.changes.custom.push({
            path: relPath,
            type: 'file'
          });
        }
      }
    }
  }

  /**
   * Create a backup of the project's .claude directory
   */
  async createBackup(projectPath) {
    const backupPath = path.join(projectPath, this.backupDir);
    const claudeDir = path.join(projectPath, '.claude');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupDestination = path.join(backupPath, backupName);

    try {
      // Create backup directory if it doesn't exist
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }

      // Copy .claude directory to backup
      this.copyDirectory(claudeDir, backupDestination);

      // Keep only last 5 backups
      this.cleanOldBackups(backupPath, 5);

      this.emit('backupCreated', {
        projectPath,
        backupPath: backupDestination,
        timestamp
      });

      return backupDestination;
    } catch (error) {
      this.emit('backupFailed', {
        projectPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Copy directory recursively
   */
  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Clean old backups, keeping only the most recent N
   */
  cleanOldBackups(backupPath, keepCount) {
    if (!fs.existsSync(backupPath)) return;

    const backups = fs.readdirSync(backupPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
      .map(entry => ({
        name: entry.name,
        path: path.join(backupPath, entry.name),
        time: fs.statSync(path.join(backupPath, entry.name)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    // Remove old backups
    backups.slice(keepCount).forEach(backup => {
      this.removeDirectory(backup.path);
    });
  }

  /**
   * Remove directory recursively
   */
  removeDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.removeDirectory(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }

    fs.rmdirSync(dir);
  }

  /**
   * Apply updates to a project
   */
  async applyUpdates(projectPath, options = {}) {
    const {
      dryRun = false,
      skipBackup = false,
      preserveCustom = true
    } = options;

    const result = {
      projectPath,
      success: false,
      backupPath: null,
      applied: {
        added: [],
        modified: [],
        skipped: []
      },
      schemaMigration: null,
      errors: []
    };

    try {
      // Analyze what needs to be updated
      const analysis = await this.analyzeUpdates(projectPath);

      if (!analysis.safe) {
        result.errors = analysis.errors;
        return result;
      }

      // Create backup unless skipped
      if (!skipBackup && !dryRun) {
        result.backupPath = await this.createBackup(projectPath);
      }

      // Apply changes
      const projectClaudeDir = path.join(projectPath, '.claude');

      // Add new files
      for (const item of analysis.changes.added) {
        const templateFilePath = path.join(this.templatePath, item.path);
        const projectFilePath = path.join(projectClaudeDir, item.path);

        if (!dryRun) {
          // Create directory if needed
          const dir = path.dirname(projectFilePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.copyFileSync(templateFilePath, projectFilePath);
        }

        result.applied.added.push(item.path);

        this.emit('fileAdded', {
          projectPath,
          file: item.path
        });
      }

      // Update modified files
      for (const item of analysis.changes.modified) {
        const templateFilePath = path.join(this.templatePath, item.path);
        const projectFilePath = path.join(projectClaudeDir, item.path);

        if (!dryRun) {
          fs.copyFileSync(templateFilePath, projectFilePath);
        }

        result.applied.modified.push(item.path);

        this.emit('fileModified', {
          projectPath,
          file: item.path
        });
      }

      // Report custom files (not touched)
      if (preserveCustom) {
        result.applied.skipped = analysis.changes.custom.map(item => item.path);
      }

      // Apply database schema migrations if needed
      if (analysis.schema && analysis.schema.needsMigration) {
        const dbPath = path.join(projectClaudeDir, 'project.db');

        this.emit('schemaMigrationStarted', {
          projectPath,
          currentVersion: analysis.schema.currentVersion,
          targetVersion: analysis.schema.expectedVersion
        });

        if (!dryRun) {
          result.schemaMigration = await this.schemaManager.migrateSchema(dbPath);

          if (!result.schemaMigration.success) {
            result.errors.push(...result.schemaMigration.errors.map(e => e.error || e));
            result.success = false;

            this.emit('schemaMigrationFailed', {
              projectPath,
              errors: result.schemaMigration.errors
            });

            return result;
          }

          this.emit('schemaMigrationComplete', {
            projectPath,
            migrations: result.schemaMigration.appliedMigrations
          });
        } else {
          // For dry run, just report what would be done
          const plan = this.schemaManager.getMigrationPlan(dbPath);
          result.schemaMigration = {
            dryRun: true,
            plan
          };
        }
      }

      result.success = true;

      this.emit('updateComplete', {
        projectPath,
        result
      });

    } catch (error) {
      result.errors.push(error.message);

      this.emit('updateFailed', {
        projectPath,
        error: error.message
      });
    }

    return result;
  }

  /**
   * Rollback a project to a backup
   */
  async rollback(projectPath, backupPath = null) {
    try {
      const claudeDir = path.join(projectPath, '.claude');
      let actualBackupPath = backupPath;

      // If no backup path specified, use most recent
      if (!actualBackupPath) {
        const backupDir = path.join(projectPath, this.backupDir);
        const backups = fs.readdirSync(backupDir, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
          .map(entry => ({
            name: entry.name,
            path: path.join(backupDir, entry.name),
            time: fs.statSync(path.join(backupDir, entry.name)).mtime
          }))
          .sort((a, b) => b.time - a.time);

        if (backups.length === 0) {
          throw new Error('No backups found');
        }

        actualBackupPath = backups[0].path;
      }

      // Remove current .claude directory
      this.removeDirectory(claudeDir);

      // Restore from backup
      this.copyDirectory(actualBackupPath, claudeDir);

      this.emit('rollbackComplete', {
        projectPath,
        backupPath: actualBackupPath
      });

      return { success: true, backupPath: actualBackupPath };
    } catch (error) {
      this.emit('rollbackFailed', {
        projectPath,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * List available backups for a project
   */
  listBackups(projectPath) {
    const backupDir = path.join(projectPath, this.backupDir);

    if (!fs.existsSync(backupDir)) {
      return [];
    }

    return fs.readdirSync(backupDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
      .map(entry => {
        const backupPath = path.join(backupDir, entry.name);
        const stats = fs.statSync(backupPath);

        return {
          name: entry.name,
          path: backupPath,
          timestamp: stats.mtime,
          size: this.getDirectorySize(backupPath)
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get total size of a directory in bytes
   */
  getDirectorySize(dir) {
    let size = 0;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        size += this.getDirectorySize(fullPath);
      } else {
        size += fs.statSync(fullPath).size;
      }
    }

    return size;
  }
}

module.exports = UpdateManager;
