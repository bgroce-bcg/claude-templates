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
- IMPORTANT: It is ok to have 1 section if the feature is small enough.
- Don't overcomlicate the plan with more sections if it is not necessary.

## Workflow

### Step 1: Validate Inputs
- If no FEATURE provided, STOP immediately and ask the user to provide it
- Check if `.claude/project.db` exists, if not run `/db-init` first
- Look for `PATH_TO_PLAN`/PLANNING.md - If it does not exist, stop immediately and ask the user to create PLANNING.md at the `PATH_TO_PLAN`

### Step 2: Read and Analyze PLANNING.md
- Read PLANNING.md thoroughly
- Think hard about how to break the plan into smaller "Plan Sections" that can be built and verified
- Sections must be small, precise, executable sections of the overall plan
- Each section should have:
  - Clear name (lowercase, dashes, no spaces)
  - Brief description/overview
  - List of objectives (what needs to be built)
  - Verification criteria (how to know it's done)
  - Optional: dependencies, time estimates

### Step 3: Insert Feature into Database
```sql
INSERT INTO features (name, planning_doc_path, summary, status, priority)
VALUES (?, ?, ?, 'ready', 0);
```
- Extract summary from PLANNING.md
- Set status to 'ready'
- Get the feature_id from the insert

### Step 4: Collect Section Information
For each section identified, gather:
- **name**: Short kebab-case name (e.g., "create-data-model")
- **description**: Brief overview of what this section does
- **objectives**: JSON array of objectives (e.g., `["Build data structure", "Create intake form"]`)
- **verification_criteria**: JSON array of completion checks (e.g., `["Form creates record", "Tests pass"]`)
- **order_index**: Sequential number (1, 2, 3...)
- **depends_on**: ID of section that must complete first (optional)
- **estimated_hours**: Time estimate (optional)

### Step 5: Insert Sections into Database
For each section:
```sql
INSERT INTO sections (
    feature_id,
    name,
    description,
    objectives,
    verification_criteria,
    order_index,
    depends_on,
    estimated_hours,
    status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending');
```

### Step 6: Optional - Create PROGRESS.md for Visual Reference
If user wants markdown file for easy viewing:
- Create `PATH_TO_PLAN`/PROGRESS.md
- Format with checkboxes for each section
- Note: This is optional - database is source of truth

### Step 7: Verify and Report
- Query database to confirm sections were created
- Run `/plan-status FEATURE` to show the plan
- Report number of sections created 

## Report
Plan created with the following sections:
- Section 1 Short Description
- Section 2 Short Description
