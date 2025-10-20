---
description: Debug and manage stuck sections in a feature plan
argument-hint: [feature-name] [optional: action]
---

# Plan Debug Command

Diagnose and fix issues with stuck sections in parallel execution.

## Usage

```bash
/plan-debug [feature-name]
/plan-debug [feature-name] reset [section-id]
/plan-debug [feature-name] reset-all
/plan-debug [feature-name] detect-cycles
```

**Examples:**
```bash
/plan-debug user-authentication
/plan-debug user-authentication reset 5
/plan-debug user-authentication reset-all
/plan-debug user-authentication detect-cycles
```

## Workflow

**CRITICAL: Use CADI Project Database**
All database operations MUST use the CADI project database located at `.claude/project.db`.

### Action: Status (Default)

Show detailed status of all sections in the feature:

**Get feature ID:**
```sql
SELECT id, name, status FROM features WHERE name = ?;
```

**Get all sections:**
```sql
SELECT id, name, status, depends_on, started_at, completed_at,
       ROUND((julianday('now') - julianday(started_at)) * 24, 2) as hours_in_progress
FROM sections
WHERE feature_id = ?
ORDER BY order_index;
```

**Report format:**
```
Feature: {name}
Status: {status}

Sections:
  [1] {section-name} (pending) - depends_on: NULL
  [2] {section-name} (in_progress) - started 2.5 hours ago
  [3] {section-name} (completed) - completed in 1.2 hours
  [4] {section-name} (pending) - depends_on: 2

Stuck sections (in_progress > 1 hour):
  [2] {section-name} - 2.5 hours (may have crashed)

Blocked sections (pending with unmet dependencies):
  [4] {section-name} - waiting for section 2
```

**Check for circular dependencies:**
```sql
SELECT id, name, depends_on
FROM sections
WHERE feature_id = ?
  AND status = 'pending'
  AND depends_on IS NOT NULL
  AND depends_on NOT IN (
    SELECT id FROM sections WHERE status = 'completed'
  );
```

If sections are pending but dependencies are also pending/in_progress, may indicate circular dependency.

### Action: Reset Section

Reset a specific section from 'in_progress' to 'pending':

```sql
UPDATE sections
SET status = 'pending',
    started_at = NULL,
    notes = notes || '\n[Reset at ' || datetime('now') || ' - agent may have crashed]'
WHERE id = ?
  AND status = 'in_progress';
```

Verify:
```sql
SELECT id, name, status FROM sections WHERE id = ?;
```

Report: "Section {id} ({name}) reset to pending. You can now retry building it."

### Action: Reset All

Reset ALL in_progress sections for a feature to pending:

**Query for stuck sections:**
```sql
SELECT id, name FROM sections
WHERE feature_id = ?
  AND status = 'in_progress';
```

**Reset each:**
```sql
UPDATE sections
SET status = 'pending',
    started_at = NULL,
    notes = notes || '\n[Bulk reset at ' || datetime('now') || ' - parallel execution restart]'
WHERE feature_id = ?
  AND status = 'in_progress';
```

Report: "Reset {count} sections to pending. Run `/plan {feature-name}` to resume."

### Action: Detect Cycles

Detect circular dependencies:

**Get all pending sections with dependencies:**
```sql
SELECT s1.id, s1.name, s1.depends_on, s2.name as depends_on_name, s2.status as depends_on_status
FROM sections s1
LEFT JOIN sections s2 ON s1.depends_on = s2.id
WHERE s1.feature_id = ?
  AND s1.status = 'pending'
  AND s1.depends_on IS NOT NULL;
```

**Build dependency graph and check for cycles:**

Algorithm:
1. Create adjacency list of dependencies
2. Run DFS to detect back edges (cycles)
3. Report any cycles found

Report format:
```
Dependency Analysis:

Section [4] {name} depends on Section [2] {depends_on_name} (in_progress)
Section [5] {name} depends on Section [4] {depends_on_name} (pending)
Section [2] {name} depends on Section [5] {depends_on_name} (pending)

CYCLE DETECTED: 2 -> 5 -> 4 -> 2

This is a circular dependency. To fix:
1. Update docs/plans/{feature}/PLANNING.md to remove cycle
2. Run `/plan-debug {feature} reset-all` to reset sections
3. Manually update section dependencies in database
4. Resume with `/plan {feature}`
```

## Use Cases

### Use Case 1: Agent Crashed

```bash
/plan-debug user-auth
# Shows section 2 stuck in_progress for 3 hours

/plan-debug user-auth reset 2
# Resets section 2 to pending

# Resume plan execution
/plan user-auth
```

### Use Case 2: Circular Dependency

```bash
/plan-debug payment-system detect-cycles
# Reports cycle: Section 3 -> 2 -> 4 -> 3

# Fix PLANNING.md
# Reset and retry
/plan-debug payment-system reset-all
/plan payment-system
```

### Use Case 3: Check Progress

```bash
/plan-debug dashboard
# Shows:
#   2 completed
#   1 in_progress (0.5 hours)
#   3 pending
#   1 blocked (waiting on in_progress)
```

## Error Handling

**Feature not found:**
```sql
SELECT name FROM features WHERE name = ?;
```
If empty, report: "Feature '{name}' not found. Run `/plan {name}` to create it."

**Invalid section ID:**
```sql
SELECT name FROM sections WHERE id = ?;
```
If empty, report: "Section {id} not found."

**No stuck sections:**
If all sections are in valid states, report: "All sections are in valid states. No action needed."

## Notes

- Use this command when `/plan` seems stuck or making no progress
- Sections stuck in `in_progress` for > 1 hour may indicate agent crashed
- Circular dependencies should be rare if planning is done correctly
- Always check `/plan-debug {feature}` before manually editing database
