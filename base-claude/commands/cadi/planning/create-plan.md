---
decription: Create a planning step document
argument-hint: [feature to plan]
---

# Create Plan
Take in `Variables`, Follow the `Workflow` and `Report` back to the user.

## Variables
FEATURE: $ARGUMENTS
PATH_TO_PLAN: docs/plans/`FEATURE`

## Instructions
**CRITICAL - Keep sections minimal:**
- 1 section is often enough for simple features
- Only create multiple sections if feature is truly complex
- Each section must be independently buildable and testable
- Sections should be 1-3 objectives max
- If you find yourself with 5+ sections, you're over-planning
- Don't create sections like "setup", "cleanup", "documentation" - those are part of implementation

## Workflow

**CRITICAL: Use CADI Project Database**
All database operations MUST use the CADI project database located at `.claude/project.db`.
Execute SQL queries using the Bash tool with `sqlite3` command:
```bash
sqlite3 .claude/project.db "SQL QUERY HERE"
```

### Step 1: Validate
- If no FEATURE: ask for it
- Check `.claude/project.db` exists (if not: `/db-init`)
- Check `PATH_TO_PLAN`/PLANNING.md exists (if not: ask user to create it)

### Step 2: Read PLANNING.md
- Read PLANNING.md
- Break into minimal sections (prefer 1-3 total)
- Each section: name (kebab-case), description (1 sentence), objectives (1-3 items as JSON array), verification_criteria (JSON array)
- **Good section**: "user-authentication" with objectives: ["Add login form", "Create auth middleware", "Add session management"]
- **Bad section**: "setup-project-structure" (this is overhead, not a feature)
- **Bad pattern**: Breaking simple feature into 5+ micro-sections

### Step 3: Insert Feature
```sql
INSERT INTO features (name, planning_doc_path, summary, status, priority)
VALUES (?, ?, ?, 'ready', 0);
```
Verify: `SELECT id FROM features WHERE name = ?;` (if failed, log error and stop)

### Step 4: Insert Sections
For each section:
```sql
INSERT INTO sections (feature_id, name, description, objectives, verification_criteria,
    order_index, depends_on, estimated_hours, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending');
```
Verify each: `SELECT id FROM sections WHERE feature_id = ? AND order_index = ?;`

### Step 5: Report
Run `/plan-status FEATURE` to show the plan. 

## Examples

### Example 1: Simple Feature (1 Section)
**Feature**: Add email notifications
**Section**: "email-notifications"
- Objectives: ["Create email service", "Add notification triggers", "Design email templates"]
- Verification: ["Users receive emails on key events", "Tests pass"]

### Example 2: Medium Feature (2 Sections)
**Feature**: User profile management
**Section 1**: "profile-backend"
- Objectives: ["Create profile API endpoints", "Add profile validation", "Create profile model"]
**Section 2**: "profile-frontend"
- Objectives: ["Build profile edit form", "Add profile display page", "Add image upload"]

### Example 3: Complex Feature (3-4 Sections Max)
**Feature**: Multi-tenant system
**Section 1**: "tenant-data-model"
- Objectives: ["Create tenant schema", "Add tenant isolation middleware", "Migrate existing data"]
**Section 2**: "tenant-ui"
- Objectives: ["Add tenant selector", "Update navigation", "Add tenant settings page"]
**Section 3**: "tenant-permissions"
- Objectives: ["Create permission system", "Add role-based access", "Update auth checks"]

**DON'T DO**: 10 micro-sections like "setup-database", "create-migrations", "write-tests", "add-documentation", etc.

## Report
Plan created with {count} section(s):
- {List section names}
