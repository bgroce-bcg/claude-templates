# CADI Manifest System

## Overview

The CADI Manifest System is a centralized configuration that serves as the **single source of truth** for all CADI file structure, database schema, and initialization logic.

Previously, CADI configuration was scattered across multiple files:
- `init-claude-project.sh` (hardcoded schema and directories)
- `SchemaManager.js` (hardcoded schema and migrations)
- `UpdateManager.js` (hardcoded file tracking rules)

Now, everything is defined in **one place**: `cadi-manifest.js`

## Benefits

1. **Single Source of Truth**: All configuration in one file
2. **Easy Updates**: Add new agents, commands, or schema changes in one place
3. **Consistency**: Init script, UpdateManager, and SchemaManager all use the same definitions
4. **Version Control**: Schema versions and migrations tracked together
5. **Maintainability**: No need to update multiple files when adding features

## Architecture

### Core Files

```
claude-templates/
├── cadi-manifest.js                              # THE SOURCE OF TRUTH
├── manifest-helper.js                            # CLI helper for bash scripts
└── packages/cadi-monitor/src/
    ├── ManifestReader.js                         # Node.js utility for reading manifest
    ├── SchemaManager.js                          # Uses manifest for schema
    └── UpdateManager.js                          # Uses manifest for file tracking
```

### Data Flow

```
┌──────────────────┐
│ cadi-manifest.js │  ← Single Source of Truth
└────────┬─────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌────────────────┐                    ┌─────────────────┐
│ Bash Scripts   │                    │ Node.js Modules │
│ (via helper)   │                    │ (via reader)    │
└────────────────┘                    └─────────────────┘
         │                                     │
         ├─────────────────┐                   ├──────────────────┐
         │                 │                   │                  │
         ▼                 ▼                   ▼                  ▼
┌──────────────┐  ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│ init script  │  │ migrate      │   │ SchemaManager│  │ UpdateManager│
└──────────────┘  └──────────────┘   └──────────────┘  └──────────────┘
```

## Manifest Structure

### 1. Schema Version
```javascript
schemaVersion: 5
```

The current database schema version. Increment when making schema changes.

### 2. Database Schema
```javascript
schema: {
  tables: {
    features: { columns: [...], indexes: [...] },
    sections: { columns: [...], indexes: [...] },
    // ... more tables
  }
}
```

Defines all database tables, columns, and indexes.

### 3. Migrations
```javascript
migrations: [
  {
    version: 1,
    description: 'Initial schema',
    up: (db) => { /* migration code */ }
  },
  // ... more migrations
]
```

Database migrations to upgrade from older versions.

### 4. Directory Structure
```javascript
directories: [
  'docs/backend',
  'docs/frontend',
  'docs/plans',
  'docs/features'
]
```

Directories created during project initialization.

### 5. File Structure
```javascript
files: {
  baseClaude: {
    source: 'base-claude',
    destination: '.claude',
    include: ['agents/**/*.md', 'commands/**/*.md', ...]
  },
  scripts: {
    source: 'scripts',
    destination: '.claude/scripts',
    include: ['*.js', '*.sh', '*.py']
  }
}
```

Defines what files get copied during initialization/updates.

### 6. File Categorization Rules
```javascript
categorization: {
  trackedExtensions: ['.md', '.js', '.sh', '.py', '.json'],
  cadiManagedPaths: [
    'agents/cadi/',
    'commands/cadi/',
    'scripts/',
    'settings.json'
  ],
  isCadiManaged: function(relativePath) { /* logic */ },
  shouldTrack: function(filename) { /* logic */ }
}
```

Rules for determining which files are CADI-managed vs custom.

## Usage

### For Bash Scripts

Use `manifest-helper.js` to read manifest data:

```bash
# Get schema version
VERSION=$(node manifest-helper.js schema-version)

# Get directories to create
node manifest-helper.js directories | while read dir; do
  mkdir -p "$dir"
done

# Generate SQL for database initialization
SQL=$(node manifest-helper.js sql)
echo "$SQL" | sqlite3 project.db

# Get summary as JSON
node manifest-helper.js summary
```

Available commands:
- `sql` - Generate SQL for database initialization
- `directories` - List directories to create
- `schema-version` - Get current schema version
- `summary` - Get manifest summary as JSON
- `agents` - List all CADI agents
- `commands` - List all CADI commands

### For Node.js Code

Use `ManifestReader` class:

```javascript
const ManifestReader = require('./ManifestReader');

const manifest = new ManifestReader();

// Get schema version
const version = manifest.getSchemaVersion();

// Get schema definition
const schema = manifest.getSchema();

// Get migrations
const migrations = manifest.getMigrations();

// Check if path is CADI-managed
const isCadi = manifest.isCadiManaged('agents/cadi/planning/plan.md');

// Check if file should be tracked
const shouldTrack = manifest.shouldTrackFile('example.md');

// Get directories
const dirs = manifest.getDirectories();

// Generate SQL
const sql = manifest.generateInitSQL();
```

## Adding New Features

### Adding a New Database Table

1. Edit `cadi-manifest.js`
2. Increment `schemaVersion`
3. Add table definition to `schema.tables`:
   ```javascript
   my_new_table: {
     columns: [
       'id INTEGER PRIMARY KEY AUTOINCREMENT',
       'name TEXT NOT NULL',
       // ... more columns
     ],
     indexes: [
       'CREATE INDEX IF NOT EXISTS idx_name ON my_new_table(name)'
     ]
   }
   ```
4. Add migration to `migrations` array:
   ```javascript
   {
     version: 6, // next version
     description: 'Add my_new_table',
     up: (db) => {
       db.exec(`
         CREATE TABLE IF NOT EXISTS my_new_table (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           name TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_name ON my_new_table(name);
       `);
     }
   }
   ```

That's it! The init script, SchemaManager, and UpdateManager will all automatically use the new schema.

### Adding a New Directory

1. Edit `cadi-manifest.js`
2. Add to `directories` array:
   ```javascript
   directories: [
     'docs/backend',
     'docs/frontend',
     'docs/plans',
     'docs/features',
     'docs/my-new-dir'  // ← Add here
   ]
   ```

Done! The init script will automatically create it.

### Adding a New Agent or Command

1. Create the `.md` file in `base-claude/agents/cadi/` or `base-claude/commands/cadi/`
2. No changes to manifest needed - it's already configured to copy all `.md` files

For tracking purposes, optionally update `getAgents()` or `getCommands()` in manifest.

### Adding a New Tracked File Extension

1. Edit `cadi-manifest.js`
2. Add to `categorization.trackedExtensions`:
   ```javascript
   trackedExtensions: ['.md', '.js', '.sh', '.py', '.json', '.yaml']
   ```

UpdateManager will now track changes to `.yaml` files.

### Adding a New CADI-Managed Path

1. Edit `cadi-manifest.js`
2. Add to `categorization.cadiManagedPaths`:
   ```javascript
   cadiManagedPaths: [
     'agents/cadi/',
     'commands/cadi/',
     'scripts/',
     'settings.json',
     'hooks/'  // ← Add new path
   ]
   ```

Files in `hooks/` will now be treated as CADI-managed during updates.

## Migration Path

### For Existing Projects

Existing projects will automatically migrate when:
1. User runs the init script with `--update` (backup created first)
2. User updates via cadi-monitor UI (uses UpdateManager)
3. SchemaManager detects outdated schema and applies migrations

### For New Projects

New projects automatically get the latest schema version defined in the manifest.

## Testing

Test the manifest system:

```bash
# Test manifest helper
node manifest-helper.js schema-version
node manifest-helper.js directories
node manifest-helper.js summary

# Test in Node.js
node -e "
const ManifestReader = require('./packages/cadi-monitor/src/ManifestReader');
const manifest = new ManifestReader();
console.log('Schema Version:', manifest.getSchemaVersion());
console.log('Tables:', Object.keys(manifest.getSchema().tables));
"
```

## Troubleshooting

### "Manifest not found" error

Make sure `cadi-manifest.js` is in the project root.

### Schema version mismatch

Run migrations via SchemaManager or re-initialize the project.

### Custom files being overwritten

Check that custom files are NOT in paths defined in `categorization.cadiManagedPaths`.

## Future Enhancements

Potential additions to the manifest system:

1. **Hooks Configuration**: Pre-commit, post-update hooks
2. **Plugin System**: Third-party extensions
3. **Environment-Specific Config**: Dev vs production schemas
4. **Validation Rules**: Schema validation before applying
5. **Rollback Support**: Automatic rollback on migration failure

## Summary

The manifest system provides:
- ✅ Single source of truth for all CADI configuration
- ✅ Easy updates - change one file, everything stays in sync
- ✅ Versioned schema with automatic migrations
- ✅ Clear separation between CADI-managed and custom files
- ✅ Both bash and Node.js support

When you need to modify CADI structure, always start with `cadi-manifest.js`.
