# Agent Logging Feature

## Overview

Track when agents call other agents to gain visibility into agent nesting and performance.

## Components

### Database Schema

**Tables:**
- `agent_invocations` - Records when an agent is invoked via Task tool
- `agent_completions` - Records when an agent completes via SubagentStop hook

**View:**
- `agent_activity` - Combines invocations and completions with timing data

**Schema Version:** 6

### Hook Scripts

Located in `.claude/scripts/`:

1. **log-agent-invocation.js**
   - Triggered by: PreToolUse hook (Task tool matcher)
   - Purpose: Log agent type, prompt, and context when Task tool is called
   - Performance: ~5ms execution time
   - Behavior: Silent fail if database doesn't exist

2. **log-agent-completion.js**
   - Triggered by: SubagentStop hook
   - Purpose: Log completion time and calculate duration
   - Uses: Temporary files in `.claude/tmp/` to match invocations
   - Performance: ~3ms execution time

### Configuration

**settings.json:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/scripts/log-agent-invocation.js",
            "timeout": 5000
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/scripts/log-agent-completion.js",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

### Commands & Scripts

1. **/init-agent-logging** (Command)
   - Purpose: Initialize agent logging tables in existing database
   - Location: `.claude/commands/cadi/setup/init-agent-logging.md`
   - Usage: `/init-agent-logging`

2. **agent-monitor.sh** (Script)
   - Purpose: View agent invocation activity
   - Location: `.claude/scripts/agent-monitor.sh`
   - Usage:
     - `.claude/scripts/agent-monitor.sh` - Recent activity (last 15)
     - `.claude/scripts/agent-monitor.sh all` - All invocations
     - `.claude/scripts/agent-monitor.sh type Explore` - Filter by agent type
     - `.claude/scripts/agent-monitor.sh session abc123` - Filter by session
     - `.claude/scripts/agent-monitor.sh feature user-auth` - Filter by feature

## Data Flow

1. **Invocation Phase:**
   ```
   User Command → Task tool called → PreToolUse hook fires
   → log-agent-invocation.js runs → Insert into agent_invocations
   → Create temp file with invocation_id
   ```

2. **Completion Phase:**
   ```
   Agent completes → SubagentStop hook fires
   → log-agent-completion.js runs → Read temp file for invocation_id
   → Calculate duration → Insert into agent_completions
   → Delete temp file
   ```

3. **Query Phase:**
   ```
   agent-monitor.sh script → Query agent_activity view
   → Display formatted results with timing
   ```

## Database Schema Details

### agent_invocations Table

```sql
CREATE TABLE agent_invocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_type TEXT NOT NULL,           -- e.g., "Explore", "general-purpose"
  agent_prompt TEXT NOT NULL,         -- Full prompt given to agent
  agent_description TEXT,             -- Short description from Task tool
  session_id TEXT NOT NULL,           -- Claude session ID
  parent_agent TEXT,                  -- Parent agent (if nested)
  feature_id INTEGER,                 -- Link to features table
  section_id INTEGER,                 -- Link to sections table
  tool_name TEXT DEFAULT 'Task',     -- Always "Task"
  tool_input TEXT,                    -- Full JSON of tool input
  invoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (feature_id) REFERENCES features(id),
  FOREIGN KEY (section_id) REFERENCES sections(id)
);
```

### agent_completions Table

```sql
CREATE TABLE agent_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invocation_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,                -- Time from invocation to completion
  tool_response TEXT,                 -- Response from agent (future)
  success BOOLEAN DEFAULT 1,
  error_message TEXT,
  FOREIGN KEY (invocation_id) REFERENCES agent_invocations(id)
);
```

### agent_activity View

```sql
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
```

## Indexes

Performance indexes created:
- `idx_agent_invocations_session` - Fast session lookups
- `idx_agent_invocations_type` - Fast type filtering
- `idx_agent_invocations_invoked_at` - Fast time-based queries
- `idx_agent_invocations_feature` - Fast feature filtering
- `idx_agent_completions_invocation` - Fast join performance
- `idx_agent_completions_session` - Fast session lookups
- `idx_agent_completions_completed_at` - Fast time-based queries

## Example Queries

### Recent agent activity
```sql
SELECT * FROM agent_activity
ORDER BY invoked_at DESC
LIMIT 15;
```

### Agent performance by type
```sql
SELECT
  agent_type,
  COUNT(*) as invocations,
  AVG(duration_ms) as avg_duration_ms,
  MIN(duration_ms) as min_duration_ms,
  MAX(duration_ms) as max_duration_ms
FROM agent_activity
WHERE duration_ms IS NOT NULL
GROUP BY agent_type
ORDER BY avg_duration_ms DESC;
```

### In-progress agents
```sql
SELECT
  invocation_id,
  agent_type,
  agent_description,
  invoked_at,
  CAST((JULIANDAY('now') - JULIANDAY(invoked_at)) * 24 * 60 * 60 * 1000 AS INTEGER) as elapsed_ms
FROM agent_activity
WHERE completed_at IS NULL
ORDER BY invoked_at ASC;
```

### Agent nesting for a session
```sql
SELECT
  agent_type,
  parent_agent,
  invoked_at,
  completed_at,
  duration_ms
FROM agent_activity
WHERE session_id = 'abc123'
ORDER BY invoked_at ASC;
```

## Performance Characteristics

- **Write overhead:** ~7-10ms per agent invocation (5ms hook + 2-3ms DB write)
- **Storage:** ~200 bytes per invocation + completion
- **Query performance:** <5ms for recent activity (with indexes)
- **Hook timeout:** 5000ms (prevents blocking on slow operations)

## Future Enhancements

1. **Parent-child tracking**
   - Use environment variables to track agent hierarchy
   - Visualize as tree structure in /agent-monitor

2. **Token usage tracking**
   - Parse tool_response for token counts
   - Show token usage per agent type

3. **Error tracking**
   - Capture failed agent invocations
   - Link to error_log table

4. **Export functionality**
   - Export agent activity to CSV/JSON
   - Generate reports on agent usage patterns

5. **Real-time monitoring**
   - Show in-progress agents with elapsed time
   - Alert on long-running agents

6. **cadi-monitor integration**
   - Web dashboard for agent activity
   - Real-time graphs and statistics
   - Agent call hierarchy visualization

## Migration Notes

- **Idempotent:** Safe to run multiple times
- **Version check:** Only applies if schema < v6
- **Non-destructive:** Doesn't modify existing tables
- **Backward compatible:** Silent fail if tables don't exist yet

## Deployment

See [AGENT-LOGGING-DEPLOYMENT.md](../AGENT-LOGGING-DEPLOYMENT.md) for full deployment instructions.

**Quick deployment:**
```bash
# Update CADI template in existing project
./init-claude-project.sh /path/to/project

# Initialize agent logging
cd /path/to/project
/init-agent-logging

# Verify
/agent-monitor recent
```
