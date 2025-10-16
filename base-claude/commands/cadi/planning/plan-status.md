---
description: View status of plans and sections from project database
argument-hint: [optional: feature name]
---

# Plan Status

Query and display plan progress from the project database.

## Variables

- **FEATURE_NAME**: $ARGUMENTS (optional - if not provided, show all features)

## Workflow

**CRITICAL: Use CADI Project Database**
All database operations MUST use the CADI project database located at `.claude/project.db`.
Execute SQL queries using the Bash tool with `sqlite3` command:
```bash
sqlite3 .claude/project.db "SQL QUERY HERE"
```

### Step 1: Check Database Exists
- Check if `.claude/project.db` exists
- If not, suggest running `/db-init` first

### Step 2: Query Features and Sections

**If FEATURE_NAME provided:**
```sql
SELECT
    f.id,
    f.name,
    f.status as feature_status,
    f.priority,
    f.created_at,
    f.started_at,
    f.completed_at
FROM features f
WHERE f.name = ?;

SELECT
    s.id,
    s.order_index,
    s.name,
    s.description,
    s.status,
    s.depends_on,
    s.estimated_hours,
    s.actual_hours,
    s.notes,
    (SELECT name FROM sections WHERE id = s.depends_on) as depends_on_name
FROM sections s
WHERE s.feature_id = ?
ORDER BY s.order_index;
```

**If no FEATURE_NAME (show all):**
```sql
SELECT
    f.name,
    f.status,
    f.priority,
    COUNT(s.id) as total_sections,
    SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) as completed_sections,
    SUM(CASE WHEN s.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_sections,
    SUM(s.estimated_hours) as total_estimated_hours,
    SUM(s.actual_hours) as total_actual_hours
FROM features f
LEFT JOIN sections s ON s.feature_id = f.id
GROUP BY f.id
ORDER BY f.priority DESC, f.created_at DESC;
```

### Step 3: Format and Display

**For single feature view:**
```
Feature: {name}
Status: {feature_status}
Path: {planning_doc_path}
Priority: {priority}
Created: {created_at}

Sections:
  [ ] 1. Section Name (pending) - 2h estimated
      Description: Brief description

  [x] 2. Another Section (completed) - 3h estimated, 3.5h actual
      Description: Brief description
      Completed: 2024-01-15

  [→] 3. In Progress Section (in_progress) - 4h estimated
      Description: Brief description
      Started: 2024-01-16

  [ ] 4. Blocked Section (pending, depends on #3) - 2h estimated
      Description: Brief description
      Depends on: In Progress Section

Next actionable: Section #4 (after #3 completes)
Progress: 1/4 sections completed (25%)
Time: 3.5h actual / 11h estimated
```

**For all features view:**
```
All Features:

1. feature-name-1 (in_progress) [Priority: 5]
   Progress: 2/5 sections (40%)
   Time: 6h / 15h estimated

2. feature-name-2 (completed) [Priority: 3]
   Progress: 3/3 sections (100%)
   Time: 8h / 10h estimated (80% efficiency)

3. feature-name-3 (ready) [Priority: 1]
   Progress: 0/4 sections (0%)
   Time: 0h / 12h estimated
```

### Step 4: Provide Insights

For single feature:
- Show next actionable section (dependencies met, status pending)
- Calculate time remaining based on estimates
- Show velocity (actual vs estimated)
- Highlight any blocked sections

For all features:
- Show which features are ready to start
- Show which features are blocked
- Calculate overall velocity across completed features

## Examples

```bash
/plan-status                    # Show all features
/plan-status user-auth          # Show user-auth feature details
/plan-status rsvp-management    # Show rsvp-management feature details
```
