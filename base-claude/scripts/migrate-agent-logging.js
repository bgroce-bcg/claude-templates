#!/usr/bin/env node

/**
 * Database Migration: Add Agent Logging Tables
 *
 * Adds tables to track agent invocations and completions for visibility
 * into when agents call other agents.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Find project root (where .claude directory is)
function findProjectRoot() {
  let currentDir = process.cwd();

  while (currentDir !== '/') {
    if (fs.existsSync(path.join(currentDir, '.claude', 'project.db'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error('Could not find .claude/project.db in any parent directory');
}

try {
  const projectRoot = findProjectRoot();
  const dbPath = path.join(projectRoot, '.claude', 'project.db');

  console.log(`Migrating database at: ${dbPath}`);

  const db = new Database(dbPath);

  // Check current schema version
  const versionTable = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='schema_version'
  `).get();

  if (!versionTable) {
    db.exec(`
      CREATE TABLE schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT
      );
      INSERT INTO schema_version (version, description)
      VALUES (1, 'Initial schema');
    `);
  }

  const currentVersion = db.prepare(
    'SELECT MAX(version) as version FROM schema_version'
  ).get().version || 0;

  console.log(`Current schema version: ${currentVersion}`);

  // Apply migration if not already applied
  if (currentVersion < 6) {
    console.log('Applying migration: Agent Logging Tables (v6)');

    db.exec(`
      BEGIN TRANSACTION;

      -- Table to track agent invocations (when Task tool is called)
      CREATE TABLE IF NOT EXISTS agent_invocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- Agent identification
        agent_type TEXT NOT NULL,        -- subagent_type from Task tool
        agent_prompt TEXT NOT NULL,      -- prompt given to agent
        agent_description TEXT,          -- description of task

        -- Context
        session_id TEXT NOT NULL,
        parent_agent TEXT,               -- if this was called by another agent
        feature_id INTEGER,
        section_id INTEGER,

        -- Hook data
        tool_name TEXT DEFAULT 'Task',
        tool_input TEXT,                 -- JSON string of full tool input

        -- Timing
        invoked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        -- Relationships
        FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
      );

      -- Table to track agent completions
      CREATE TABLE IF NOT EXISTS agent_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- Link to invocation
        invocation_id INTEGER NOT NULL,

        -- Completion data
        session_id TEXT NOT NULL,
        completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        duration_ms INTEGER,             -- calculated from invocation

        -- Output info
        tool_response TEXT,              -- JSON string of tool response
        success BOOLEAN DEFAULT 1,
        error_message TEXT,

        -- Relationships
        FOREIGN KEY (invocation_id) REFERENCES agent_invocations(id) ON DELETE CASCADE
      );

      -- Indexes for performance
      CREATE INDEX idx_agent_invocations_session ON agent_invocations(session_id);
      CREATE INDEX idx_agent_invocations_type ON agent_invocations(agent_type);
      CREATE INDEX idx_agent_invocations_invoked_at ON agent_invocations(invoked_at DESC);
      CREATE INDEX idx_agent_invocations_feature ON agent_invocations(feature_id);
      CREATE INDEX idx_agent_completions_invocation ON agent_completions(invocation_id);
      CREATE INDEX idx_agent_completions_session ON agent_completions(session_id);
      CREATE INDEX idx_agent_completions_completed_at ON agent_completions(completed_at DESC);

      -- View for easy querying of agent activity with timing
      CREATE VIEW agent_activity AS
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

      -- Update schema version
      INSERT INTO schema_version (version, description)
      VALUES (6, 'Add agent invocation and completion tracking');

      COMMIT;
    `);

    console.log('✓ Migration completed successfully');
    console.log('✓ Added agent_invocations table');
    console.log('✓ Added agent_completions table');
    console.log('✓ Added agent_activity view');
    console.log('✓ Schema version updated to 6');
  } else {
    console.log('Database already at version 6 or higher. No migration needed.');
  }

  db.close();

} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
