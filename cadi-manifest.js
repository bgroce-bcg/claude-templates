/**
 * CADI Manifest - Single Source of Truth
 *
 * This file defines everything about CADI's structure:
 * - Database schema and migrations
 * - File structure (agents, commands, scripts, hooks, settings)
 * - Directory structure
 * - File categorization rules
 *
 * When you need to add/modify CADI features, update this file only.
 */

module.exports = {
  // Current schema version
  schemaVersion: 5,

  // Database schema definition
  schema: {
    tables: {
      features: {
        columns: [
          'id INTEGER PRIMARY KEY AUTOINCREMENT',
          'name TEXT NOT NULL UNIQUE',
          'planning_doc_path TEXT NOT NULL',
          'summary TEXT',
          'status TEXT CHECK(status IN (\'planning\', \'ready\', \'in_progress\', \'completed\')) DEFAULT \'planning\'',
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
          'status TEXT CHECK(status IN (\'pending\', \'in_progress\', \'completed\')) DEFAULT \'pending\'',
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
      }
    }
  },

  // Database migrations
  migrations: [
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
    }
  ],

  // Directory structure to create in target projects
  directories: [
    'docs/backend',
    'docs/frontend',
    'docs/plans',
    'docs/features'
  ],

  // File structure - what gets copied from the template
  files: {
    // Files from base-claude/ get copied to .claude/
    baseClaude: {
      source: 'base-claude',
      destination: '.claude',
      include: [
        'agents/**/*.md',
        'commands/**/*.md',
        '.claude/settings.json'
      ]
    },

    // Scripts from root scripts/ get copied to .claude/scripts/
    scripts: {
      source: 'scripts',
      destination: '.claude/scripts',
      include: [
        '*.js',
        '*.sh',
        '*.py'
      ]
    }
  },

  // File categorization rules
  // Used to determine if a file is CADI-managed or custom
  categorization: {
    // Extensions to track for changes
    trackedExtensions: ['.md', '.js', '.sh', '.py', '.json'],

    // Paths that are always CADI-managed
    cadiManagedPaths: [
      'agents/cadi/',
      'commands/cadi/',
      'scripts/',
      'settings.json'
    ],

    // Files that should be treated as custom (even if they match patterns)
    // These are preserved during updates
    customFilePaths: [
      // Top-level agents/commands (not in cadi/ subdirs)
      'agents/*.md',
      'commands/*.md'
    ],

    // Check if a path is CADI-managed
    isCadiManaged: function(relativePath) {
      // Normalize path separators
      const normalized = relativePath.replace(/\\/g, '/');

      return this.cadiManagedPaths.some(pattern => {
        if (pattern.endsWith('/')) {
          // Directory pattern - check if path starts with it
          return normalized.startsWith(pattern) || normalized.includes('/' + pattern);
        } else {
          // File pattern - check for exact match or in subdirectory
          return normalized === pattern || normalized.endsWith('/' + pattern);
        }
      });
    },

    // Check if a file should be tracked
    shouldTrack: function(filename) {
      return this.trackedExtensions.some(ext => filename.endsWith(ext));
    }
  },

  // Hooks configuration (for future expansion)
  hooks: {
    // Pre-commit hooks
    preCommit: [],

    // Post-update hooks
    postUpdate: [],

    // Pre-init hooks
    preInit: []
  },

  // Generate SQL for database initialization
  generateInitSQL: function() {
    const sql = [];

    // Generate CREATE TABLE statements
    for (const [tableName, tableDef] of Object.entries(this.schema.tables)) {
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

    // Add initial schema version
    sql.push(`INSERT INTO schema_version (version) VALUES (${this.schemaVersion});`);

    return sql.join('\n');
  },

  // Get list of all CADI agents
  getAgents: function() {
    // This would scan base-claude/agents/cadi/**/*.md
    // For now, return the structure
    return {
      planning: [
        'plan-section-builder.md',
        'agent-builder.md'
      ],
      development: [
        'quick-feature-builder.md'
      ],
      'code-quality': [
        'test-builder.md',
        'refactor-advisor.md',
        'code-reviewer.md'
      ],
      context: [
        'context-loader.md'
      ],
      git: [
        'git-helper.md'
      ]
    };
  },

  // Get list of all CADI commands
  getCommands: function() {
    return {
      setup: [
        'init-agent-logging.md'
      ],
      planning: [
        'plan.md',
        'plan-status.md',
        'plan-edit.md'
      ],
      development: [
        'test.md',
        'quick-feature.md',
        'lint.md',
        'commit.md'
      ],
      context: [
        'prime-frontend.md',
        'prime-backend.md',
        'load-context.md',
        'index-docs.md'
      ],
      monitoring: [
        'errors.md',
        'context-monitor.md'
      ]
    };
  }
};
