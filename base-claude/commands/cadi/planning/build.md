---
decription: Build the plan
argument-hint: [path to planned feature]
---

# Build

## Variables
`PATH_TO_PLAN` = docs/plans/$ARGUMENTS

## Workflow

### Step 1: Initial Setup
- If you have not already run /prime-backend this session, then Run /prime-backend slash command. If you have, then skip this step
- Check if `.claude/project.db` exists, if not suggest `/db-init`

### Step 2: Get Feature ID
Query database for feature:
```sql
SELECT id, name, status, planning_doc_path
FROM features
WHERE name = $ARGUMENTS;
```
- If not found, suggest running `/create-plan` first
- Store feature_id for subsequent queries

### Step 3: Find Next Available Section
Query for next actionable section:
```sql
SELECT
    s.id,
    s.name,
    s.description,
    s.objectives,
    s.verification_criteria,
    s.order_index,
    s.estimated_hours
FROM sections s
WHERE s.feature_id = ?
AND s.status = 'pending'
AND (s.depends_on IS NULL OR s.depends_on IN (
    SELECT id FROM sections WHERE status = 'completed'
))
ORDER BY s.order_index
LIMIT 1;
```

### Step 4: Check Section Availability
**If no sections found:**
- Check if any in_progress:
  ```sql
  SELECT id, name FROM sections
  WHERE feature_id = ? AND status = 'in_progress';
  ```
  If found, ask user if they want to continue those sections
- Check if all completed:
  ```sql
  SELECT COUNT(*) FROM sections
  WHERE feature_id = ? AND status != 'completed';
  ```
  If 0, run `/complete-plan $ARGUMENTS`
- Check for blocked sections:
  ```sql
  SELECT s.id, s.name, s.depends_on, ds.name as blocks_on_name
  FROM sections s
  JOIN sections ds ON s.depends_on = ds.id
  WHERE s.feature_id = ? AND s.status = 'pending' AND ds.status != 'completed';
  ```
  Report which sections are blocking

### Step 5: Update Section Status to In Progress
```sql
UPDATE sections
SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
WHERE id = ?;
```

### Step 6: Build Section
Launch plan-section-builder agent with:
- **section_id**: The database ID of the section
- **planning_document_path**: Path to PLANNING.md from feature query

### Step 7: Post-Build Actions
- Wait until plan-section-builder is complete (includes /lint, /test, code-reviewer)
- Agent will update section status to 'completed' with actual_hours
- Ask user if they want to commit this section's changes via `/commit`

### Step 8: Continue or Complete
- Query again for next available section (return to Step 3)
- If all sections completed, run `/complete-plan $ARGUMENTS`
- If sections remain, ask user if they want to continue with next section

## Report
Give a short status report for each section that was built:
- Section name and status
- Time taken (actual vs estimated)
- Files created/modified
- Next section to build (if any)