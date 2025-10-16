---
decription: Build the plan
argument-hint: [path to planned feature]
---

# Build

## Variables
`PATH_TO_PLAN` = docs/plans/$ARGUMENTS

## Workflow

**CRITICAL: Use CADI Project Database**
All database operations MUST use the CADI project database located at `.claude/project.db`.
Execute SQL queries using the Bash tool with `sqlite3` command:
```bash
sqlite3 .claude/project.db "SQL QUERY HERE"
```

### Step 1: Get Feature
```sql
SELECT id, name, status, planning_doc_path FROM features WHERE name = $ARGUMENTS;
```
If not found: suggest `/create-plan`. If SQL error: log error.

### Step 2: Find Next Section
```sql
SELECT s.id, s.name FROM sections s
WHERE s.feature_id = ? AND s.status = 'pending'
AND (s.depends_on IS NULL OR s.depends_on IN (SELECT id FROM sections WHERE status = 'completed'))
ORDER BY s.order_index LIMIT 1;
```
If none: check in_progress, if none check if all done → `/complete-plan`.

### Step 3: Mark In Progress
```sql
UPDATE sections SET status = 'in_progress', started_at = CURRENT_TIMESTAMP WHERE id = ?;
```
Verify: `SELECT status FROM sections WHERE id = ?;` (if failed, log error)

### Step 4: Build
Launch `plan-section-builder` with **section_id** and **planning_document_path**.

### Step 5: Verify Completion
```sql
SELECT status FROM sections WHERE id = ?;
```
If still 'in_progress', manually set to 'completed' and report.

### Step 6: Commit
Create commit for section changes (unless tests failed).

### Step 7: Loop
Return to Step 2 until all sections done, then `/complete-plan`.

## Report
Give a short status report for each section that was built:
- Section name and status
- Time taken (actual vs estimated)
- Files created/modified
- Next section to build (if any)