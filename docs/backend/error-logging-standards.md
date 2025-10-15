---
title: Error Logging Standards
category: backend
tags: [error-handling, logging, debugging, monitoring]
summary: Guidelines for logging errors in agents and commands to ensure visibility into unexpected behaviors and failures
---

# Error Logging Standards

## Purpose

All agents and commands MUST log errors when they encounter unexpected responses or when operations fail. This ensures you can diagnose issues and improve system reliability.

## When to Log Errors

**ALWAYS log:**
- Database ops fail (INSERT/UPDATE/DELETE/query errors)
- Commands fail (/prime-backend, /test, /lint)
- File ops fail (read/write required files)
- API/network failures

**DO NOT log (normal flow):**
- User provides invalid input
- Expected "not found" cases
- User cancels operation

## Error Severity Levels

- **critical**: Cannot continue, data at risk (DB update failed after retries)
- **error**: Operation failed, can continue (query failed, priming failed)
- **warning**: Non-critical (missing optional file, deprecated pattern)

## Error Logging Pattern

### Standard Template

```sql
INSERT INTO error_log (
    feature_id,      -- If applicable (can be NULL)
    section_id,      -- If applicable (can be NULL)
    agent_name,      -- For agents (NULL for commands)
    command_name,    -- For commands (NULL for agents)
    severity,        -- 'critical' | 'error' | 'warning'
    error_type,      -- See error types below
    error_message,   -- Human-readable message with details
    context,         -- JSON string with additional context
    created_at       -- CURRENT_TIMESTAMP
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
```

### Error Types

`database_insert_failed`, `database_update_failed`, `database_query_failed`, `file_read_failed`, `file_write_failed`, `priming_failed`, `test_failed`, `api_request_failed`, `validation_failed`, `unexpected_response`

### Context JSON Structure

Always include relevant context as a JSON string:

```json
{
  "step": "Step 3",
  "agent": "plan-section-builder",
  "operation": "database_update",
  "feature": "storage-locations",
  "section_id": 5,
  "attempted_value": "completed",
  "actual_value": "in_progress",
  "retry_count": 2
}
```

## Examples

### Example 1: Database Update Failed

```sql
INSERT INTO error_log (
    feature_id, section_id, severity, error_type,
    error_message, agent_name, context, created_at
) VALUES (
    12, 5, 'critical', 'database_update_failed',
    'Failed to update section status to completed after 3 attempts',
    'plan-section-builder',
    '{"step": "Step 7", "section_name": "create-api-endpoint", "retry_count": 3}',
    CURRENT_TIMESTAMP
);
```

### Example 2: Priming Command Failed

```sql
INSERT INTO error_log (
    severity, error_type, error_message, agent_name,
    context, created_at
) VALUES (
    'error', 'priming_failed',
    'Failed to execute /prime-backend command',
    'quick-feature-builder',
    '{"step": "Step 2", "command": "/prime-backend", "error": "docs/backend not found"}',
    CURRENT_TIMESTAMP
);
```

### Example 3: File Read Failed

```sql
INSERT INTO error_log (
    severity, error_type, error_message, agent_name,
    context, created_at
) VALUES (
    'warning', 'file_read_failed',
    'Failed to read documentation file: docs/backend/api-patterns.md',
    'context-loader',
    '{"operation": "indexing", "file": "docs/backend/api-patterns.md", "reason": "Permission denied"}',
    CURRENT_TIMESTAMP
);
```

## Verification Pattern

After critical DB ops:
1. Perform operation
2. Verify: `SELECT status FROM table WHERE id = ?;`
3. If failed: retry 2x (3 total attempts)
4. Still failing: log error, report to user

## Monitoring Errors

### View Recent Errors

Query the `recent_errors` view:

```sql
SELECT * FROM recent_errors LIMIT 20;
```

### Check Errors for Specific Feature

```sql
SELECT
    el.severity,
    el.error_type,
    el.error_message,
    el.created_at,
    el.context
FROM error_log el
JOIN features f ON el.feature_id = f.id
WHERE f.name = 'storage-locations'
ORDER BY el.created_at DESC;
```

### Count Errors by Type

```sql
SELECT
    error_type,
    severity,
    COUNT(*) as error_count
FROM error_log
WHERE created_at >= datetime('now', '-7 days')
GROUP BY error_type, severity
ORDER BY error_count DESC;
```

## Which Agents/Commands Need Logging

**Database ops:** `plan-section-builder`, `build`, `create-plan`, `complete-plan`, `context-loader`
**Execution:** `quick-feature-builder`, `test-builder`, `code-reviewer`
**File ops:** `context-loader`, any agent reading/writing docs/

## Error Message Guidelines

✅ **Good:** "Failed to update section status to completed after 3 attempts"
❌ **Bad:** "Update failed"

Be specific, include context.

## Best Practices

1. Include actual vs expected values
2. Use standard error_type values
3. Log immediately when error occurs
4. Always report errors to user
5. Include step number and operation in context

## Database Schema Reference

```sql
CREATE TABLE error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id INTEGER,
    section_id INTEGER,
    agent_name TEXT,
    command_name TEXT,
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'error', 'warning')),
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    context TEXT, -- JSON string
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);
```
