#!/usr/bin/env node

/**
 * Manifest Helper for Bash Scripts
 *
 * Allows bash scripts to read data from cadi-manifest.js
 * Usage: node manifest-helper.js <command> [args...]
 *
 * Commands:
 *   sql           - Output SQL for database initialization
 *   directories   - Output directories to create (one per line)
 *   schema-version - Output current schema version
 *   summary       - Output manifest summary as JSON
 */

const path = require('path');
const fs = require('fs');

// Load manifest
const manifestPath = path.join(__dirname, 'cadi-manifest.js');
if (!fs.existsSync(manifestPath)) {
  console.error('Error: cadi-manifest.js not found');
  process.exit(1);
}

const manifest = require(manifestPath);

// Parse command
const command = process.argv[2];

switch (command) {
  case 'sql':
    // Generate SQL for database initialization
    console.log(manifest.generateInitSQL());
    break;

  case 'directories':
    // Output directories one per line
    manifest.directories.forEach(dir => {
      console.log(dir);
    });
    break;

  case 'schema-version':
    // Output schema version
    console.log(manifest.schemaVersion);
    break;

  case 'summary':
    // Output summary as JSON
    console.log(JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      tableCount: Object.keys(manifest.schema.tables).length,
      migrationCount: manifest.migrations.length,
      directoryCount: manifest.directories.length,
      trackedExtensions: manifest.categorization.trackedExtensions,
      cadiManagedPaths: manifest.categorization.cadiManagedPaths
    }, null, 2));
    break;

  case 'agents':
    // Output agent structure as JSON
    console.log(JSON.stringify(manifest.getAgents(), null, 2));
    break;

  case 'commands':
    // Output command structure as JSON
    console.log(JSON.stringify(manifest.getCommands(), null, 2));
    break;

  case 'help':
  default:
    console.log(`
Manifest Helper - Read data from cadi-manifest.js

Usage: node manifest-helper.js <command>

Commands:
  sql             Generate SQL for database initialization
  directories     List directories to create (one per line)
  schema-version  Output current schema version
  summary         Output manifest summary as JSON
  agents          List all CADI agents as JSON
  commands        List all CADI commands as JSON
  help            Show this help message
`);
    if (command && command !== 'help') {
      process.exit(1);
    }
}
