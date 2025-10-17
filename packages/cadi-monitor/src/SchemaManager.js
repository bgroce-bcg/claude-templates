const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const ManifestReader = require('./ManifestReader');

/**
 * Manages database schema validation and migrations
 * Ensures project databases have the correct structure
 *
 * Now reads schema and migrations from cadi-manifest.js
 */
class SchemaManager {
  constructor(manifestPath = null) {
    // Load manifest
    this.manifestReader = new ManifestReader(manifestPath);

    // Get schema and migrations from manifest
    this.schemaVersion = this.manifestReader.getSchemaVersion();
    this.expectedSchema = {
      version: this.schemaVersion,
      tables: this.manifestReader.getSchema().tables
    };
    this.migrations = this.manifestReader.getMigrations();
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
    // Use manifest's method to generate SQL
    return this.manifestReader.generateInitSQL();
  }
}

module.exports = SchemaManager;
