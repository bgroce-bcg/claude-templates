#!/usr/bin/env node

/**
 * Hook Script: Log Agent Completion
 *
 * Triggered by SubagentStop hook when an agent finishes.
 * Logs completion timing and outcome to the database.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Read hook input from stdin
let inputData = '';

process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const hookInput = JSON.parse(inputData);

    // Find project root
    const projectRoot = findProjectRoot(hookInput.cwd);
    const dbPath = path.join(projectRoot, '.claude', 'project.db');

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      // Silent fail - database not initialized yet
      process.exit(0);
    }

    const db = new Database(dbPath);

    // Check if agent_completions table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='agent_completions'
    `).get();

    if (!tableExists) {
      // Silent fail - migration not run yet
      db.close();
      process.exit(0);
    }

    // Find the most recent invocation for this session
    const tmpDir = path.join(projectRoot, '.claude', 'tmp');
    let invocationId = null;
    let invokedAt = null;

    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir)
        .filter(f => f.startsWith('invocation-') && f.endsWith('.json'))
        .filter(f => f.includes(hookInput.session_id));

      if (files.length > 0) {
        // Get the most recent one
        files.sort().reverse();
        const invocationFile = path.join(tmpDir, files[0]);
        const invocationData = JSON.parse(fs.readFileSync(invocationFile, 'utf8'));
        invocationId = invocationData.invocation_id;
        invokedAt = new Date(invocationData.invoked_at);

        // Clean up the file
        fs.unlinkSync(invocationFile);
      }
    }

    // If we couldn't find an invocation file, try to find the most recent
    // invocation in the database for this session
    if (!invocationId) {
      const recentInvocation = db.prepare(`
        SELECT id, invoked_at
        FROM agent_invocations
        WHERE session_id = ?
        ORDER BY invoked_at DESC
        LIMIT 1
      `).get(hookInput.session_id);

      if (recentInvocation) {
        invocationId = recentInvocation.id;
        invokedAt = new Date(recentInvocation.invoked_at);
      } else {
        // No invocation found - this might be a top-level session
        db.close();
        process.exit(0);
      }
    }

    // Calculate duration
    const completedAt = new Date();
    const durationMs = invokedAt ? completedAt - invokedAt : null;

    // Check if this invocation already has a completion record
    const existing = db.prepare(`
      SELECT id FROM agent_completions WHERE invocation_id = ?
    `).get(invocationId);

    if (existing) {
      // Already logged - this can happen if the hook fires multiple times
      db.close();
      process.exit(0);
    }

    // Insert completion record
    const stmt = db.prepare(`
      INSERT INTO agent_completions (
        invocation_id,
        session_id,
        duration_ms,
        tool_response,
        success
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      invocationId,
      hookInput.session_id,
      durationMs,
      null, // We don't have access to tool_response in SubagentStop
      1 // Assume success unless we add error tracking
    );

    db.close();

    // Success
    process.exit(0);

  } catch (error) {
    // Log error but don't block
    console.error('Error logging agent completion:', error.message);
    process.exit(0);
  }
});

function findProjectRoot(startDir) {
  let currentDir = startDir || process.cwd();

  while (currentDir !== '/') {
    if (fs.existsSync(path.join(currentDir, '.claude', 'project.db'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback to cwd if not found
  return startDir || process.cwd();
}
