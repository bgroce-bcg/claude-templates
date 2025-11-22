#!/usr/bin/env node

/**
 * Hook Script: Log Agent Invocation
 *
 * Triggered by PreToolUse hook when Task tool is called.
 * Logs agent invocation details to the database.
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

    // Check if agent_invocations table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='agent_invocations'
    `).get();

    if (!tableExists) {
      // Silent fail - migration not run yet
      db.close();
      process.exit(0);
    }

    // Extract agent information from tool input
    const toolInput = hookInput.tool_input || {};
    const agentType = toolInput.subagent_type || 'unknown';
    const agentPrompt = toolInput.prompt || '';
    const agentDescription = toolInput.description || '';

    // Try to determine parent agent from environment or session
    const parentAgent = process.env.CADI_CURRENT_AGENT || null;

    // Try to get current feature/section context
    const featureId = process.env.CADI_FEATURE_ID || null;
    const sectionId = process.env.CADI_SECTION_ID || null;

    // Insert invocation record
    const stmt = db.prepare(`
      INSERT INTO agent_invocations (
        agent_type,
        agent_prompt,
        agent_description,
        session_id,
        parent_agent,
        feature_id,
        section_id,
        tool_name,
        tool_input
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      agentType,
      agentPrompt,
      agentDescription,
      hookInput.session_id,
      parentAgent,
      featureId,
      sectionId,
      hookInput.tool_name,
      JSON.stringify(toolInput)
    );

    // Store invocation ID in a file for the completion hook to reference
    const invocationIdFile = path.join(
      projectRoot,
      '.claude',
      'tmp',
      `invocation-${hookInput.session_id}-${Date.now()}.json`
    );

    // Ensure tmp directory exists
    const tmpDir = path.dirname(invocationIdFile);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    fs.writeFileSync(
      invocationIdFile,
      JSON.stringify({
        invocation_id: result.lastInsertRowid,
        session_id: hookInput.session_id,
        agent_type: agentType,
        invoked_at: new Date().toISOString()
      })
    );

    db.close();

    // Success - allow the tool call to proceed
    process.exit(0);

  } catch (error) {
    // Log error but don't block the tool call
    console.error('Error logging agent invocation:', error.message);
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
