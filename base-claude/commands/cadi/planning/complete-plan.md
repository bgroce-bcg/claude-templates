# Complete Plan
Take in a FEATURE varialbe, then execute the Workflow, then Report back to the user.

## Variables

- `FEATURE`= $ARGUMENTS: feature the plan implemented (e.g., `storage-locations`)

## Workflow

### Step 1: Validate Feature Completion
Query database to verify all sections are complete:
```sql
SELECT
    COUNT(*) as total_sections,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sections
FROM sections
WHERE feature_id = (SELECT id FROM features WHERE name = ?);
```
- If not all completed, list remaining sections and stop
- Ask user if they want to continue anyway (mark as completed despite incomplete sections)

### Step 2: Run Final Quality Checks
- Run `/test` to ensure all tests pass for the entire feature
- Run `/lint` to check for any remaining code quality issues
- If issues found, report them and ask user if they want to proceed with completion

### Step 3: Perform Final Code Review
- Use `code-reviewer` agent to review all files modified for this feature
- Check docs/feature/`FEATURE`/ for list of modified files
- Report any critical issues found
- Suggest any final improvements

### Step 4: Clean Up Feature Documentation
- Check if docs/feature/`FEATURE`/README.md exists
- If exists, read and refine it:
  - Remove duplicate information
  - Make it information-dense
  - Ensure it helps developers understand what the feature does and how it's built
  - Keep code examples brief
- If doesn't exist, warn user but continue

### Step 5: Update Database
Mark feature as completed:
```sql
UPDATE features
SET
    status = 'completed',
    completed_at = CURRENT_TIMESTAMP
WHERE name = ?;
```

### Step 6: Archive Planning Files (Optional)
- If docs/plans/`FEATURE`/PROGRESS.md exists, can be removed (database has the data)
- If docs/plans/`FEATURE`/sections/ directory exists, can be removed (no longer needed)
- Keep PLANNING.md for historical reference
- Ask user if they want to clean up these files

### Step 7: Final Commit
- Ask user if they want to create a final commit for this feature using `/commit` command

### Step 8: Show Summary
- Run `/plan-status FEATURE` to show final statistics:
  - Total sections completed
  - Total time: actual vs estimated
  - Efficiency percentage
  - Files created/modified

## Report

Report back to the user that the plan has been cleaned up and documented.