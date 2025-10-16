---
description: Edit plan sections interactively
argument-hint: [feature name]
---

# Plan Edit

Interactively edit sections for a feature in the project database.

## Variables

- **FEATURE_NAME**: $ARGUMENTS (required)

## Workflow

**CRITICAL: Use CADI Project Database**
All database operations MUST use the CADI project database located at `.claude/project.db`.
Execute SQL queries using the Bash tool with `sqlite3` command:
```bash
sqlite3 .claude/project.db "SQL QUERY HERE"
```

### Step 1: Validate Input
- If no FEATURE_NAME provided, stop and ask for feature name
- Check if `.claude/project.db` exists, if not suggest `/db-init`
- Query feature from database:
  ```sql
  SELECT id, name, status FROM features WHERE name = ?
  ```
- If not found, list available features and ask user to try again

### Step 2: Load Current Sections
Query all sections for the feature:
```sql
SELECT
    id,
    order_index,
    name,
    description,
    objectives,
    verification_criteria,
    status,
    depends_on,
    estimated_hours,
    notes
FROM sections
WHERE feature_id = ?
ORDER BY order_index;
```

### Step 3: Display Current State
Show sections in readable format:
```
Current Sections for: {feature_name}

1. Section Name (pending) - 2h est
   Depends on: None

2. Another Section (completed) - 3h est
   Depends on: None

3. Third Section (pending) - 4h est
   Depends on: #1 Section Name
```

### Step 4: Offer Edit Operations

Present menu:
```
What would you like to do?
1. Add new section
2. Edit existing section
3. Reorder sections
4. Delete section
5. Change dependencies
6. Update estimates
7. Done (exit)
```

### Step 5: Execute Operation

**For "Add new section":**
- Ask for: name, description, objectives (JSON array), verification_criteria (JSON array)
- Ask for position in order (default: end)
- Ask for dependencies (optional)
- Ask for estimated_hours (optional)
- INSERT INTO sections
- Update order_index for affected sections
- Show updated list

**For "Edit existing section":**
- Ask which section (by number or id)
- Show current values
- Ask what to change (name, description, objectives, verification, estimates, notes)
- UPDATE sections SET ... WHERE id = ?
- Show updated section

**For "Reorder sections":**
- Ask for new order (e.g., "3, 1, 2, 4" or "move 3 to position 1")
- UPDATE sections SET order_index = ? WHERE id = ?
- Show updated order

**For "Delete section":**
- Ask which section
- Warn if other sections depend on it
- If confirmed: DELETE FROM sections WHERE id = ?
- Update order_index for remaining sections
- Show updated list

**For "Change dependencies":**
- Ask which section
- Show current dependencies
- Ask for new dependency (section id or "none")
- Validate no circular dependencies
- UPDATE sections SET depends_on = ? WHERE id = ?
- Show updated dependencies

**For "Update estimates":**
- Show all sections with current estimates
- Ask which to update
- Ask for new estimated_hours
- UPDATE sections SET estimated_hours = ? WHERE id = ?
- Show updated estimates

### Step 6: Loop or Exit
- If user selects "Done", exit
- Otherwise, show updated sections and return to Step 4

### Step 7: Final Confirmation
- Show summary of changes made
- Run `/plan-status {feature_name}` to show final state

## Examples

```bash
/plan-edit user-authentication
/plan-edit rsvp-management
```

## Notes

- This command only modifies the database
- PLANNING.md files are not automatically updated (user maintains those separately)
- Cannot edit sections that are "in_progress" or "completed" without confirmation
- Validates dependencies to prevent circular references
