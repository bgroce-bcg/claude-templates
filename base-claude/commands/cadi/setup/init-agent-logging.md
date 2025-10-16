---
name: init-agent-logging
description: Initialize agent invocation logging tables in the database
---

# Initialize Agent Logging

Sets up database tables for tracking agent invocations and completions. This enables the `/agent-monitor` command to visualize when agents call other agents.

## Usage

```bash
/init-agent-logging
```

## Workflow

### Step 1: Check Database Exists

Check if `.claude/project.db` exists:

```bash
ls -la .claude/project.db
```

If not found:
```
❌ Database not found at .claude/project.db

Please initialize the CADI database first. This typically happens automatically
when you use CADI planning commands, or you can initialize it manually.
```

### Step 2: Run Migration

Run the migration script to create agent logging tables:

```bash
node .claude/scripts/migrate-agent-logging.js
```

The script will:
- Check current schema version
- Create `agent_invocations` table
- Create `agent_completions` table
- Create `agent_activity` view for easy querying
- Add indexes for performance
- Update schema version to 6

### Step 3: Verify Setup

Query the database to verify tables were created:

```bash
sqlite3 .claude/project.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'agent_%';"
```

Should show:
- agent_invocations
- agent_completions

### Step 4: Verify Hooks

Check if hooks are configured:

```bash
ls -la .claude/settings.json
```

If settings.json doesn't exist:
```
⚠️  Hooks not configured

Agent logging hooks are not configured. This file should have been installed
automatically by the init script.

To fix, re-run the init script:
  cd /path/to/claude-templates
  ./init-claude-project.sh /path/to/this/project

Or manually copy from the template:
  cp /path/to/claude-templates/base-claude/.claude/settings.json .claude/
```

### Step 5: Verify Scripts

Check if logging scripts exist:

```bash
ls -la .claude/scripts/log-agent-*.js
```

Should find:
- log-agent-invocation.js
- log-agent-completion.js

If missing, report that the CADI template needs to be updated.

### Step 6: Success Report

```
✅ Agent Logging Initialized Successfully

**Database:** .claude/project.db
**Schema version:** 6
**Tables created:**
- agent_invocations
- agent_completions
**Views created:**
- agent_activity

**Hook scripts:**
- ✓ log-agent-invocation.js
- ✓ log-agent-completion.js

**Hooks configured:**
- ✓ PreToolUse → Task tool
- ✓ SubagentStop → All agents

**Next steps:**
- Agent invocations will now be logged automatically
- Use `.claude/scripts/agent-monitor.sh` to view agent activity
- Examples:
  - `.claude/scripts/agent-monitor.sh` - Recent activity (last 15)
  - `.claude/scripts/agent-monitor.sh all` - All invocations
  - `.claude/scripts/agent-monitor.sh type Explore` - Filter by agent type
  - `.claude/scripts/agent-monitor.sh session abc123` - Filter by session
  - `.claude/scripts/agent-monitor.sh feature user-auth` - Filter by feature
```

## Edge Cases

**Database doesn't exist:**
- Report error with instructions
- Don't create database here - that's handled by planning commands

**Migration already applied:**
- Script will detect schema version ≥ 6
- Report: "Agent logging already initialized (schema v6+)"
- Show success message anyway

**Migration fails:**
- Show error message from script
- Common issues:
  - Database is locked (close other connections)
  - Permissions issue
  - Corrupted database

**settings.json already exists:**
- This is rare in CADI projects
- The init script will have installed/updated it automatically
- If you have custom hooks, they would have been preserved during update

**Missing better-sqlite3:**
- Report: "Missing required dependency: better-sqlite3"
- Instruct: "Run `npm install better-sqlite3` in your project root"

## Notes

- This command is idempotent - safe to run multiple times
- Schema version tracking prevents duplicate migrations
- Hooks will silently fail if database doesn't exist (by design)
- Agent logging has minimal performance impact (~5ms per agent call)
- The .claude/tmp/ directory is used for tracking invocation IDs between hooks
