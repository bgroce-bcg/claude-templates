const path = require('path');
const fs = require('fs');

/**
 * ManifestReader - Utility for reading and working with cadi-manifest.js
 *
 * Provides helper methods to access manifest data for initialization and updates.
 */
class ManifestReader {
  constructor(manifestPath = null) {
    // Default to root of project (3 levels up from this file)
    this.manifestPath = manifestPath || path.join(__dirname, '../../../cadi-manifest.js');

    if (!fs.existsSync(this.manifestPath)) {
      throw new Error(`Manifest not found at ${this.manifestPath}`);
    }

    // Load the manifest
    this.manifest = require(this.manifestPath);
  }

  /**
   * Get the current schema version
   */
  getSchemaVersion() {
    return this.manifest.schemaVersion;
  }

  /**
   * Get the complete schema definition
   */
  getSchema() {
    return this.manifest.schema;
  }

  /**
   * Get all migrations
   */
  getMigrations() {
    return this.manifest.migrations;
  }

  /**
   * Get migrations needed for a specific version upgrade
   */
  getMigrationsFrom(currentVersion) {
    return this.manifest.migrations.filter(m => m.version > currentVersion);
  }

  /**
   * Generate SQL for initializing a fresh database
   */
  generateInitSQL() {
    return this.manifest.generateInitSQL();
  }

  /**
   * Get directory structure that should be created
   */
  getDirectories() {
    return this.manifest.directories;
  }

  /**
   * Get file structure configuration
   */
  getFileStructure() {
    return this.manifest.files;
  }

  /**
   * Get categorization rules
   */
  getCategorization() {
    return this.manifest.categorization;
  }

  /**
   * Check if a path is CADI-managed
   */
  isCadiManaged(relativePath) {
    return this.manifest.categorization.isCadiManaged(relativePath);
  }

  /**
   * Check if a file should be tracked based on extension
   */
  shouldTrackFile(filename) {
    return this.manifest.categorization.shouldTrack(filename);
  }

  /**
   * Get list of all CADI agents
   */
  getAgents() {
    return this.manifest.getAgents();
  }

  /**
   * Get list of all CADI commands
   */
  getCommands() {
    return this.manifest.getCommands();
  }

  /**
   * Get hooks configuration
   */
  getHooks() {
    return this.manifest.hooks;
  }

  /**
   * Get paths that should be copied during initialization/update
   * Returns array of { source, destination, pattern } objects
   */
  getFilesToCopy(templateBasePath) {
    const filesToCopy = [];

    // Process base-claude files
    const baseClaude = this.manifest.files.baseClaude;
    for (const pattern of baseClaude.include) {
      // Handle settings.json specially (it's in base-claude/.claude)
      if (pattern === '.claude/settings.json') {
        filesToCopy.push({
          source: path.join(templateBasePath, baseClaude.source, '.claude/settings.json'),
          destination: '.claude/settings.json',
          pattern: 'settings.json'
        });
      } else {
        // For agents and commands, source is directly under base-claude/
        filesToCopy.push({
          source: path.join(templateBasePath, baseClaude.source, pattern),
          destination: path.join(baseClaude.destination, pattern),
          pattern: pattern
        });
      }
    }

    // Process scripts
    const scripts = this.manifest.files.scripts;
    for (const pattern of scripts.include) {
      filesToCopy.push({
        source: path.join(templateBasePath, scripts.source, pattern),
        destination: path.join(scripts.destination, pattern),
        pattern: pattern
      });
    }

    return filesToCopy;
  }

  /**
   * Get list of file extensions to track during updates
   */
  getTrackedExtensions() {
    return this.manifest.categorization.trackedExtensions;
  }

  /**
   * Generate a summary of the manifest
   */
  getSummary() {
    return {
      schemaVersion: this.manifest.schemaVersion,
      tableCount: Object.keys(this.manifest.schema.tables).length,
      migrationCount: this.manifest.migrations.length,
      directoryCount: this.manifest.directories.length,
      trackedExtensions: this.manifest.categorization.trackedExtensions,
      cadiManagedPaths: this.manifest.categorization.cadiManagedPaths
    };
  }
}

module.exports = ManifestReader;
