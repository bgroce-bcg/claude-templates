# Error Logging Guide for CADI Agents

This guide explains how agents should log errors encountered during execution, even when they find workarounds. Error logging helps improve the system by identifying recurring issues and patterns.

## Why Log Errors?

- **System Improvement**: Track issues even when resolved to identify patterns
- **Debugging**: Help developers understand what agents are encountering
- **Metrics**: Measure system reliability and agent effectiveness
- **Documentation**: Build knowledge base of common issues and solutions

## When to Log Errors

Log errors in these scenarios:

1. **Recoverable Errors**: When you encounter an issue but find a workaround
2. **Unexpected Behavior**: When something doesn't work as expected
3. **Missing Resources**: When required files, dependencies, or data are missing
4. **Tool Failures**: When external tools or commands fail
5. **Data Issues**: When parsing, validation, or processing fails
6. **Permission Problems**: When file system or database access is denied

**Don't Log**:
- Expected validation failures (user input errors)
- Intentional flow control (using exceptions for logic)
- Successful operations

## Error Severity Levels

- **`low`**: Minor issues with minimal impact, easily worked around
- **`medium`**: Moderate issues requiring workarounds, some impact on quality
- **`high`**: Significant issues affecting functionality, substantial workarounds needed
- **`critical`**: Severe issues that could lead to data loss or system failure

## How to Log Errors

### Using SQLite

Agents can log errors directly to the database using SQLite INSERT statements:

```sql
INSERT INTO error_log (
    agent_name,
    command_name,
    feature_id,
    section_id,
    error_type,
    error_message,
    error_context,
    resolution,
    severity
) VALUES (
    'plan-section-builder',
    '/build',
    1,
    3,
    'File Not Found',
    'Could not find backend API documentation at expected path',
    'Expected: docs/backend/api-endpoints.md\nActual: File does not exist\nSearched: docs/, api/, backend/',
    'Used fallback documentation from docs/backend/api-architecture.md and inferred endpoints from route files',
    'medium'
);
```

### Field Descriptions

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `agent_name` | Yes | Name of the agent logging the error | `'plan-section-builder'` |
| `command_name` | No | Command that triggered the agent | `'/build'`, `'/quick-feature'` |
| `feature_id` | No | ID of the feature being worked on | `1` |
| `section_id` | No | ID of the section being worked on | `3` |
| `error_type` | Yes | Category of error | `'File Not Found'`, `'Parse Error'`, `'Tool Failure'` |
| `error_message` | Yes | Clear description of what went wrong | `'Could not parse PLANNING.md: Invalid YAML frontmatter'` |
| `error_context` | No | Additional context (paths, commands, stack traces) | File contents, command output, paths tried |
| `resolution` | No | How the error was resolved or worked around | `'Used alternative approach X'` |
| `severity` | No | Impact level (defaults to 'medium') | `'low'`, `'medium'`, `'high'`, `'critical'` |
| `resolved` | No | Whether error is resolved (defaults to 0) | `0` (unresolved), `1` (resolved) |

### Using Bash

If an agent uses bash, you can log errors from shell scripts:

```bash
sqlite3 .claude/project.db << EOF
INSERT INTO error_log (agent_name, error_type, error_message, error_context, resolution, severity)
VALUES (
    'git-helper',
    'Git Operation Failed',
    'git push failed with exit code 1',
    '$(git push 2>&1)',
    'Resolved by pulling latest changes and resolving merge conflicts',
    'medium'
);
EOF
```

### Example Scenarios

#### 1. Missing Documentation File

```sql
INSERT INTO error_log (
    agent_name, command_name, feature_id,
    error_type, error_message, error_context, resolution, severity
) VALUES (
    'context-loader', '/prime-backend', NULL,
    'Missing Documentation',
    'Expected backend API documentation file not found',
    'Path: docs/backend/api-endpoints.md\nAlternatives tried:\n- docs/api.md\n- docs/backend/README.md',
    'Indexed available docs from docs/backend/ directory. Found 3 files with API information.',
    'low'
);
```

#### 2. Parsing Error with Recovery

```sql
INSERT INTO error_log (
    agent_name, feature_id, section_id,
    error_type, error_message, error_context, resolution, severity
) VALUES (
    'plan-section-builder', 1, 2,
    'Parse Error',
    'Failed to parse objectives as JSON array',
    'Raw value: "Create user authentication\nImplement login/logout\nAdd password reset"',
    'Split by newlines and converted to JSON array format',
    'medium'
);
```

#### 3. Tool Failure

```sql
INSERT INTO error_log (
    agent_name, command_name,
    error_type, error_message, error_context, resolution, severity
) VALUES (
    'test-builder', '/test',
    'Command Execution Failed',
    'npm test failed with non-zero exit code',
    'Exit code: 1\nOutput: Error: Cannot find module ''@testing-library/react''',
    'Installed missing dependency @testing-library/react and re-ran tests successfully',
    'high'
);
```

#### 4. Permission Issue

```sql
INSERT INTO error_log (
    agent_name, feature_id,
    error_type, error_message, error_context, resolution, severity
) VALUES (
    'code-reviewer', 1,
    'File System Error',
    'Permission denied when trying to write review results',
    'Path: docs/features/auth-system/REVIEW.md\nError: EACCES: permission denied',
    'Wrote review results to console output instead. User should check file permissions.',
    'medium'
);
```

## Best Practices

### 1. Be Specific
❌ **Bad**: "Error occurred"
✅ **Good**: "Failed to parse PLANNING.md: Missing required 'sections' field in YAML frontmatter"

### 2. Include Context
Always provide enough context to reproduce or understand the issue:
- File paths
- Command that was run
- Expected vs actual behavior
- Relevant file contents or output

### 3. Document Your Resolution
Explain HOW you worked around the issue:
❌ **Bad**: "Fixed it"
✅ **Good**: "Used fallback approach: read from alternative config file at .env.local instead of .env"

### 4. Choose Appropriate Severity

**Low**: Minor annoyances
- Missing optional documentation
- Deprecated but working API usage
- Cosmetic formatting issues

**Medium**: Moderate issues
- Missing expected files (with fallback)
- Parse errors (recovered)
- Non-critical tool failures

**High**: Significant problems
- Critical files missing (partial functionality lost)
- Data validation failures
- Test failures affecting quality

**Critical**: System-breaking
- Database corruption
- Security vulnerabilities
- Complete feature failures

### 5. Update When Resolved

If you later fix an error's root cause, update the `resolved` flag:

```sql
UPDATE error_log
SET resolved = 1
WHERE id = 123;
```

## Querying Errors

### View Recent Errors
```sql
SELECT * FROM error_log
ORDER BY timestamp DESC
LIMIT 10;
```

### View Unresolved High/Critical Errors
```sql
SELECT * FROM error_log
WHERE severity IN ('high', 'critical')
AND resolved = 0
ORDER BY timestamp DESC;
```

### Errors by Agent
```sql
SELECT agent_name, COUNT(*) as error_count, AVG(severity) as avg_severity
FROM error_log
GROUP BY agent_name
ORDER BY error_count DESC;
```

### Errors for a Feature
```sql
SELECT e.*, f.name as feature_name, s.name as section_name
FROM error_log e
LEFT JOIN features f ON e.feature_id = f.id
LEFT JOIN sections s ON e.section_id = s.id
WHERE e.feature_id = 1
ORDER BY e.timestamp DESC;
```

## Viewing in CADI Monitor

The CADI Monitor dashboard provides an "Errors" view where you can:
- See error statistics (total, by severity, by agent)
- Filter by severity level
- Filter by resolved/unresolved status
- View full error details with context
- See which feature/section each error relates to

To view errors:
1. Open CADI Monitor: `cadi-monitor start`
2. Select your project from the sidebar
3. Click the "Errors" tab
4. Use filters to narrow down errors

## Integration with Agents

### In Agent Markdown Files

Add error logging guidance to your agent prompts:

```markdown
## Error Handling

If you encounter any issues during execution:

1. Log the error to the database using the error_log table
2. Include specific error details, context, and your resolution
3. Set appropriate severity level
4. Continue with your task using the workaround

Example:
```sql
INSERT INTO error_log (agent_name, error_type, error_message, resolution, severity)
VALUES ('your-agent-name', 'Error Type', 'What went wrong', 'How you fixed it', 'medium');
```
```

### In Command Workflows

Commands can check for recent errors after running agents:

```sql
SELECT COUNT(*) as recent_errors
FROM error_log
WHERE agent_name = 'plan-section-builder'
AND timestamp > datetime('now', '-1 hour')
AND severity IN ('high', 'critical');
```

## Maintenance

### Cleaning Up Old Errors

```sql
-- Archive resolved errors older than 30 days
DELETE FROM error_log
WHERE resolved = 1
AND timestamp < datetime('now', '-30 days');

-- Or export them first
SELECT * FROM error_log
WHERE resolved = 1
AND timestamp < datetime('now', '-30 days');
```

### Generating Reports

```sql
-- Weekly error summary
SELECT
    DATE(timestamp) as date,
    COUNT(*) as total_errors,
    SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
    SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
    SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) as resolved
FROM error_log
WHERE timestamp > datetime('now', '-7 days')
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

## Future Enhancements

Potential improvements to the error logging system:
- Auto-detection of similar errors (pattern matching)
- Error frequency alerts (threshold-based notifications)
- Integration with CI/CD pipelines
- Error trend analysis and visualization
- Automatic issue creation for recurring high-severity errors

---

**Remember**: The goal is continuous improvement. Even when you successfully work around an issue, logging it helps prevent future occurrences and improves the system for everyone.
