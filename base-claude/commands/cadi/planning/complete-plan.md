# Complete Plan
Take in a FEATURE varialbe, then execute the Workflow, then Report back to the user.

## Variables

- `FEATURE`= $ARGUMENTS: feature the plan implemented (e.g., `storage-locations`)

## Workflow

### Step 1: Validate Completion
```sql
SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as done
FROM sections WHERE feature_id = (SELECT id FROM features WHERE name = ?);
```
If not all done: list remaining, ask to continue anyway.

### Step 2: Quality Check
- `/test`
- `/lint`
- If failures: report and ask to proceed

### Step 3: Mark Complete
```sql
UPDATE features SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE name = ?;
```
Verify: `SELECT status FROM features WHERE name = ?;` (retry once if failed)

### Step 4: Show Summary
Run `/plan-status FEATURE` for final stats.

## Report

Report back to the user that the plan has been cleaned up and documented.