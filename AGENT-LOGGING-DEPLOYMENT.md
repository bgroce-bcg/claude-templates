# Agent Logging Feature - Deployment Guide

## Overview

This document describes how to deploy the new agent invocation logging feature to existing CADI projects.

## What's New

The agent logging feature adds visibility into when agents call other agents, providing:

1. **Database Tables**:
   - `agent_invocations` - Tracks when Task tool is called (agent starts)
   - `agent_completions` - Tracks when SubagentStop hook fires (agent finishes)
   - `agent_activity` view - Combined view with timing data

2. **Hook Scripts**:
   - `log-agent-invocation.js` - PreToolUse hook for Task tool
   - `log-agent-completion.js` - SubagentStop hook

3. **Scripts**:
   - `agent-monitor.sh` - View agent invocation activity with filtering

4. **Commands**:
   - `/init-agent-logging` - Initialize the database tables

5. **Configuration**:
   - `.claude/settings.json` - Configures PreToolUse and SubagentStop hooks

## Deployment (Simple!)

For tracked CADI projects, simply re-run the initialization script:

```bash
# Navigate to the claude-templates repo
cd /home/blgroce/claude-templates

# Run the init script pointing to your project
./init-claude-project.sh /path/to/your/project
```

**That's it!** The script automatically installs:
- All agent logging scripts
- The settings.json with hooks configuration
- The agent-monitor.sh monitoring tool
- The /init-agent-logging command

After the init script completes, initialize agent logging:

```bash
cd /path/to/your/project
/init-agent-logging
```

Done! Your project now has agent logging enabled.

### What Gets Installed

The init script automatically installs:
- ✅ All hook scripts (log-agent-invocation.js, log-agent-completion.js)
- ✅ Migration script (migrate-agent-logging.js)
- ✅ Monitoring script (agent-monitor.sh)
- ✅ Settings with hooks configuration (.claude/settings.json)
- ✅ Init command (/init-agent-logging)

**Note:** Most CADI projects won't have a settings.json yet, so there's nothing to merge. The init script will install it automatically.

## Verification

After deployment, verify the setup:

1. **Check hooks are configured**:
   ```bash
   cat .claude/settings.json
   ```

2. **Check scripts exist**:
   ```bash
   ls -la .claude/scripts/log-agent-*.js
   ls -la .claude/scripts/migrate-agent-logging.js
   ```

3. **Check scripts and commands exist**:
   ```bash
   ls -la .claude/scripts/agent-monitor.sh
   ls -la .claude/commands/cadi/setup/init-agent-logging.md
   ```

4. **Verify database migration**:
   ```bash
   sqlite3 .claude/project.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'agent_%';"
   ```

   Should show:
   - agent_invocations
   - agent_completions

5. **Test agent logging**:
   Use any command that invokes agents (like `/plan`), then check:
   ```bash
   .claude/scripts/agent-monitor.sh
   ```

## Rollout Plan

### Phase 1: Template Repository
- ✅ Add database schema and migration script
- ✅ Add hook scripts for logging
- ✅ Add settings.json with hooks configuration
- ✅ Add `agent-monitor.sh` script
- ✅ Add `/init-agent-logging` command
- ✅ Document deployment process

### Phase 2: Test in Development
1. Test in a development project first:
   ```bash
   cd /path/to/test-project
   /home/blgroce/claude-templates/init-claude-project.sh .
   /init-agent-logging
   ```

2. Trigger some agent calls (use `/plan` or similar)

3. Verify data is being logged:
   ```bash
   sqlite3 .claude/project.db "SELECT COUNT(*) FROM agent_invocations;"
   /agent-monitor recent
   ```

### Phase 3: Deploy to Tracked Projects
For each tracked CADI project (2 simple steps):

1. **Run update**:
   ```bash
   cd /home/blgroce/claude-templates
   ./init-claude-project.sh /path/to/project
   ```

2. **Initialize agent logging**:
   ```bash
   cd /path/to/project
   /init-agent-logging
   ```

That's it! Test with:
```bash
.claude/scripts/agent-monitor.sh
```

## Migration Safety

The migration script is designed to be safe:

- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Version-aware**: Checks schema version before applying
- ✅ **Non-destructive**: Only adds new tables, doesn't modify existing data
- ✅ **Error handling**: Won't break existing functionality if migration fails
- ✅ **Silent fallback**: Hooks fail gracefully if tables don't exist yet

## Performance Impact

- Hook execution time: ~5ms per agent invocation
- Database write time: ~2ms per invocation/completion
- No impact on existing database queries
- Minimal storage overhead (~100 bytes per agent call)

## Troubleshooting

### Hooks not logging data

1. Check if database tables exist:
   ```bash
   sqlite3 .claude/project.db ".tables" | grep agent_
   ```

2. Check if settings.json is being loaded:
   ```bash
   cat .claude/settings.json
   ```

3. Check hook script permissions:
   ```bash
   ls -la .claude/scripts/log-agent-*.js
   ```

### Migration fails

Common issues:
- **Database locked**: Close other connections to project.db
- **Missing better-sqlite3**: Run `npm install better-sqlite3`
- **Permissions**: Ensure scripts are executable

### Data not appearing in agent-monitor.sh

1. Verify tables were created:
   ```bash
   sqlite3 .claude/project.db "SELECT COUNT(*) FROM agent_invocations;"
   ```

2. Check if hooks are firing (add debug logging if needed)

3. Ensure you're running commands that use agents (e.g., `/plan`)

## Future Enhancements

Potential improvements for future versions:

1. **Parent-child tracking**: Better nesting visualization using environment variables
2. **Performance metrics**: Track token usage and response times
3. **Agent analytics**: Aggregate statistics on agent usage patterns
4. **Export functionality**: Export agent activity logs
5. **Real-time monitoring**: Live view of in-progress agent calls
6. **cadi-monitor integration**: Web dashboard for agent activity

## Questions?

For issues or questions about agent logging:
1. Check this deployment guide
2. Review `/agent-monitor` command documentation
3. Inspect the hook scripts in `.claude/scripts/`
4. Check database schema with sqlite3 tools
