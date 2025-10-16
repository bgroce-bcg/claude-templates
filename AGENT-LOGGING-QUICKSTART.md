# Agent Logging - Quick Start

## Deploy to Existing CADI Project

Two simple commands:

```bash
# 1. Update the project with agent logging
cd /home/blgroce/claude-templates
./init-claude-project.sh /path/to/your/project

# 2. Initialize agent logging database tables
cd /path/to/your/project
/init-agent-logging
```

Done! Agent logging is now active.

## View Agent Activity

```bash
# Recent activity (last 15)
.claude/scripts/agent-monitor.sh

# All invocations
.claude/scripts/agent-monitor.sh all

# Filter by agent type
.claude/scripts/agent-monitor.sh type Explore

# Filter by session
.claude/scripts/agent-monitor.sh session abc123

# Filter by feature
.claude/scripts/agent-monitor.sh feature user-auth
```

## What You Get

- **Automatic logging** - Every time an agent calls another agent, it's tracked
- **Performance data** - See how long each agent invocation takes
- **Session tracking** - Follow the chain of agent calls in a session
- **Feature context** - See which feature work triggered which agents

## How It Works

1. **PreToolUse hook** - Fires when Task tool is called, logs invocation
2. **SubagentStop hook** - Fires when agent completes, logs timing
3. **Database storage** - All data stored in `.claude/project.db`
4. **View with script** - Query and display with `agent-monitor.sh`

## Troubleshooting

**No data showing up?**
```bash
# Check if tables exist
sqlite3 .claude/project.db "SELECT COUNT(*) FROM agent_invocations;"

# Check if hooks are configured
cat .claude/settings.json

# Make sure you're using agents (try /plan or similar)
```

**Migration failed?**
```bash
# Make sure better-sqlite3 is installed
npm install better-sqlite3

# Re-run migration
node .claude/scripts/migrate-agent-logging.js
```

## Technical Details

- **Database**: SQLite (`project.db`)
- **Tables**: `agent_invocations`, `agent_completions`
- **View**: `agent_activity` (joins both tables)
- **Schema version**: 6
- **Performance**: ~5ms overhead per agent call
- **Storage**: ~200 bytes per invocation

## Files Installed

```
.claude/
├── settings.json                    # Hooks configuration
├── scripts/
│   ├── log-agent-invocation.js     # PreToolUse hook
│   ├── log-agent-completion.js     # SubagentStop hook
│   ├── migrate-agent-logging.js    # Database migration
│   └── agent-monitor.sh            # Monitoring script
└── commands/
    └── cadi/
        └── setup/
            └── init-agent-logging.md  # Init command
```

## Learn More

- Full deployment guide: [AGENT-LOGGING-DEPLOYMENT.md](AGENT-LOGGING-DEPLOYMENT.md)
- Technical details: [docs/features/agent-logging.md](docs/features/agent-logging.md)
- Corrections applied: [AGENT-LOGGING-CORRECTIONS.md](AGENT-LOGGING-CORRECTIONS.md)
