---
description: View and monitor system errors logged by agents and commands
argument-hint: [optional: filter by severity or feature name]
---

# Errors

View errors logged by agents and commands to identify and diagnose issues.

## Variables

- **FILTER**: $ARGUMENTS (optional: "critical", "error", "warning", or feature name)

## Workflow

**CRITICAL: Use CADI Project Database**
All database operations MUST use the CADI project database located at `.claude/project.db`.
Execute SQL queries using the Bash tool with `sqlite3` command:
```bash
sqlite3 .claude/project.db "SQL QUERY HERE"
```

### Step 1: Check Database
Verify error_log table exists:
```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='error_log';
```
If not found, inform user that error logging system needs migration.

### Step 2: Build Query

**If no FILTER provided:**
Show recent errors across all severities:
```sql
SELECT * FROM recent_errors LIMIT 20;
```

**If FILTER is severity (critical/error/warning):**
```sql
SELECT
    el.id,
    el.severity,
    el.error_type,
    el.error_message,
    COALESCE(el.agent_name, el.command_name) as source,
    f.name as feature_name,
    s.name as section_name,
    el.created_at
FROM error_log el
LEFT JOIN features f ON el.feature_id = f.id
LEFT JOIN sections s ON el.section_id = s.id
WHERE el.severity = ?
ORDER BY el.created_at DESC
LIMIT 50;
```

**If FILTER is feature name:**
```sql
SELECT
    el.id,
    el.severity,
    el.error_type,
    el.error_message,
    COALESCE(el.agent_name, el.command_name) as source,
    s.name as section_name,
    el.created_at
FROM error_log el
JOIN features f ON el.feature_id = f.id
LEFT JOIN sections s ON el.section_id = s.id
WHERE f.name = ?
ORDER BY el.created_at DESC;
```

### Step 3: Display Results

Format output as a readable table:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECENT ERRORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ID  | Severity | Type                    | Source              | Feature          | When
----|----------|-------------------------|---------------------|------------------|-------------
42  | critical | database_update_failed  | plan-section-builder| storage-locations| 2 hours ago
41  | error    | priming_failed          | quick-feature-builder| -               | 3 hours ago
40  | warning  | file_read_failed        | context-loader      | -                | 1 day ago

Total: 3 errors
```

### Step 4: Provide Details for Critical Errors

For any `critical` errors in the results, show full details:

```sql
SELECT
    id,
    severity,
    error_type,
    error_message,
    agent_name,
    command_name,
    context,
    created_at
FROM error_log
WHERE id = ?;
```

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL ERROR #42
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type: database_update_failed
Source: plan-section-builder (agent)
Message: Failed to update section status to completed after 3 attempts
Time: 2024-10-15 14:23:45

Context:
{
  "step": "Step 7",
  "section_name": "create-api-endpoint",
  "retry_count": 3,
  "section_id": 5,
  "feature": "storage-locations"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 5: Show Statistics

Query error statistics:

```sql
SELECT
    severity,
    COUNT(*) as count
FROM error_log
WHERE created_at >= datetime('now', '-7 days')
GROUP BY severity;
```

```sql
SELECT
    error_type,
    COUNT(*) as count
FROM error_log
WHERE created_at >= datetime('now', '-7 days')
GROUP BY error_type
ORDER BY count DESC
LIMIT 10;
```

Display summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ERROR STATISTICS (Last 7 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

By Severity:
  Critical: 2
  Error: 15
  Warning: 8

By Type:
  database_update_failed: 8
  priming_failed: 5
  file_read_failed: 7
  test_failed: 3
  api_request_failed: 2

Total errors: 25
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 6: Suggest Actions

Based on the errors found:

**If critical errors exist:**
- Recommend investigating immediately
- Suggest which features/sections might be affected
- Provide commands to check feature/section status

**If many errors of same type:**
- Identify the pattern
- Suggest potential fixes (e.g., "Run migration", "Check file permissions")

**If no errors:**
```
✓ No errors found. System is running smoothly!
```

## Examples

```bash
/errors                   # Show all recent errors
/errors critical          # Show only critical errors
/errors warning           # Show only warnings
/errors storage-locations # Show errors for specific feature
```

## Advanced Queries

### Clear Old Errors

If user wants to clean up old errors:
```sql
DELETE FROM error_log
WHERE created_at < datetime('now', '-30 days')
AND severity = 'warning';
```

### Export Errors for Feature

For debugging a specific feature:
```sql
SELECT
    el.created_at,
    el.severity,
    el.error_type,
    el.error_message,
    el.context
FROM error_log el
JOIN features f ON el.feature_id = f.id
WHERE f.name = ?
ORDER BY el.created_at;
```

## Report

Provide a concise summary:

```
📊 Error Report

Recent Errors: {count}
- Critical: {count}
- Errors: {count}
- Warnings: {count}

{If critical errors exist:}
⚠️ ACTION REQUIRED: {count} critical error(s) need attention

{If no errors:}
✓ System healthy
```
