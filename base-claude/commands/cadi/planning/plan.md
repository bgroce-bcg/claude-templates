---
description: Unified planning command - creates and builds a complete feature plan
argument-hint: [feature-name] [optional: brief description]
---

# Plan Command

Unified command that creates a feature plan, breaks it into sections, and builds them automatically.

## Usage

```bash
/plan [feature-name] [optional: brief description]
```

**Examples:**
```bash
/plan user-authentication
/plan email-notifications "Add email notifications for key events"
/plan guest-management "Complete guest booking and management system"
```

## Workflow

**CRITICAL: Use CADI Project Database**
All database operations MUST use the CADI project database located at `.claude/project.db`.

### Step 1: Load Context

Load project context from database:
```bash
# Launch context-loader agent for backend
context-loader request="backend architecture and patterns" category="backend" list_only="false"

# Launch context-loader agent for frontend
context-loader request="frontend architecture and patterns" category="frontend" list_only="false"
```

If context-loader agent is not available or fails, fallback to:
```bash
/load-context both
```

### Step 2: Gather Requirements

- Parse arguments: FEATURE = first argument, DESCRIPTION = remaining arguments
- If no FEATURE: ask for it
- If no DESCRIPTION: ask user for brief feature description (1-2 sentences)
- Ask ONE clarifying question if needed for requirements (keep brief, optional)

### Step 3: Create PLANNING.md

**Planning Guidelines - CRITICAL - Keep it minimal:**
- Summary: 2-3 sentences max
- Requirements: Only what's necessary to build
- Skip sections that don't add value
- Focus on WHAT to build, not HOW

Write PLANNING.md to `docs/plans/{FEATURE}/PLANNING.md`:

```markdown
# {FEATURE} - PLANNING

## Summary
{2-3 sentence description from user}

## Requirements
- {Bullet list of specific, concrete requirements}
- {Focus on functionality, not implementation details}

## UI / UX (if applicable)
- {Key user interactions}
- {Navigation changes}

## Sections

### {section-1-name}
**Description:** {1 sentence}
**Objectives:**
- {objective 1}
- {objective 2}
**Verification:**
- {how to verify this section is complete}

### {section-2-name} (if needed)
**Description:** {1 sentence}
**Objectives:**
- {objective 1}
**Verification:**
- {verification criteria}

## Notes
- {Dependencies on other features/systems}
- {Any constraints}
```

**Section Guidelines:**
- 1 section is often enough for simple features
- Only create multiple sections if truly complex
- Each section: 1-3 objectives max
- If you find yourself with 5+ sections, you're over-planning
- Don't create sections like "setup", "cleanup", "documentation"

### Step 4: Insert into Database

**Insert Feature:**
```sql
INSERT INTO features (name, planning_doc_path, summary, status, priority)
VALUES (?, ?, ?, 'ready', 0);
```

Get feature_id:
```sql
SELECT id FROM features WHERE name = ?;
```

**Insert Sections:**
For each section in PLANNING.md:
```sql
INSERT INTO sections (feature_id, name, description, objectives, verification_criteria,
    order_index, depends_on, estimated_hours, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending');
```

Where:
- `name`: kebab-case section name
- `objectives`: JSON array of objective strings
- `verification_criteria`: JSON array of verification strings
- `order_index`: 0, 1, 2, etc.
- `depends_on`: NULL or ID of previous section if sequential dependency

Verify each insert:
```sql
SELECT id FROM sections WHERE feature_id = ? AND order_index = ?;
```

If any database operation fails, log error and stop:
```sql
INSERT INTO error_log (severity, error_type, error_message, agent_name, context)
VALUES ('error', 'database_insert_failed', ?, 'plan-command', ?);
```

### Step 5: Show Plan Status

Display plan overview:
```bash
/plan-status FEATURE
```

### Step 6: Build All Sections

Loop through sections in order:

**Get next pending section:**
```sql
SELECT s.id, s.name FROM sections s
WHERE s.feature_id = ? AND s.status = 'pending'
AND (s.depends_on IS NULL OR s.depends_on IN
    (SELECT id FROM sections WHERE status = 'completed'))
ORDER BY s.order_index LIMIT 1;
```

**Mark section in progress:**
```sql
UPDATE sections SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
WHERE id = ?;
```

**Build section:**
Launch `plan-section-builder` agent with:
- section_id: {section_id}
- planning_document_path: docs/plans/{FEATURE}/PLANNING.md

**Verify completion:**
```sql
SELECT status FROM sections WHERE id = ?;
```

If still 'in_progress', manually mark as completed.

**Create commit (optional):**
After each section completes, optionally create a commit:
```bash
git add .
git commit -m "Implement {feature-name}: {section-name}

{brief description of what was implemented}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Repeat** until all sections are completed.

### Step 7: Quality Check

Run final quality checks:
```bash
/test
/lint
```

If failures: report and ask user if they want to proceed with completion.

### Step 8: Mark Feature Complete

```sql
UPDATE features SET status = 'completed', completed_at = CURRENT_TIMESTAMP
WHERE name = ?;
```

Verify:
```sql
SELECT status FROM features WHERE name = ?;
```

### Step 9: Final Report

Show final status:
```bash
/plan-status FEATURE
```

Report completion:
```
## Feature Implementation Complete

**Feature:** {FEATURE}
**Sections completed:** {count}
**Total time:** {time}

**Files modified:**
- {list of key files}

**Next steps:**
- Review changes
- Test thoroughly
- Create pull request (if needed)

Run `/plan-status {FEATURE}` to see detailed metrics.
```

## Edge Cases

**Database doesn't exist:**
- Run `/db-init` first
- Report to user and stop

**Feature already exists:**
- Check if status is 'completed'
- Ask user if they want to continue/restart

**Section build fails:**
- Log error to error_log table
- Report to user with details
- Ask if they want to skip section or retry

**Tests fail:**
- Report failures
- Ask user if they want to continue or fix first

**No sections in PLANNING.md:**
- Create single section with all requirements
- Warn user and ask to confirm

## Planning Examples

### Example 1: Simple Feature (1 Section)
```bash
/plan email-notifications "Send emails on key events"
```

Creates:
- 1 section: "email-notifications"
- Objectives: Create email service, Add triggers, Design templates
- Builds and completes automatically

### Example 2: Medium Feature (2 Sections)
```bash
/plan user-profiles
```

Asks for description, creates:
- Section 1: "profile-backend" (API + model)
- Section 2: "profile-frontend" (UI components)
- Builds both sequentially

### Example 3: Complex Feature (3 Sections)
```bash
/plan multi-tenant "Add multi-tenant support with isolation"
```

Creates:
- Section 1: "tenant-data-model"
- Section 2: "tenant-ui"
- Section 3: "tenant-permissions"
- Builds all three in order

## Notes

- This command replaces: `/start-plan`, `/create-plan`, `/build`, `/complete-plan`
- Uses database-driven context loading instead of prime commands
- Minimizes user questions - just feature description
- Automatically progresses through all sections
- Creates commits after each section (configurable)
- Runs quality checks before marking complete
