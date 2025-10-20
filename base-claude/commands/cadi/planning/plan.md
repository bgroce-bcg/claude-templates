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

**CRITICAL: Parallel Section Execution**
This command builds sections in parallel when dependencies allow:
- Multiple `plan-section-builder` agents run simultaneously
- Database coordinates execution via `sections.status` and `sections.depends_on`
- Sections with no dependencies start immediately
- Dependent sections wait for prerequisites to complete
- See `docs/design/PARALLEL_SECTION_BUILDING.md` for full design details

### Step 1: Discover and Load Relevant Context (Selective Loading)

**IMPORTANT:** Use selective loading to avoid loading unnecessary documentation.

1. **Gather initial requirements** (quick analysis):
   - Parse arguments: FEATURE = first argument, DESCRIPTION = remaining arguments
   - Determine if feature is likely backend-only, frontend-only, or full-stack based on name/description
   - Examples:
     - "api-validation" → backend-only
     - "dashboard-widgets" → frontend-only
     - "user-authentication" → full-stack

2. **Discover available documentation**:

   **If feature appears backend-only**:
   ```bash
   context-loader request="backend architecture and patterns" category="backend" list_only="true"
   ```

   **If feature appears frontend-only**:
   ```bash
   context-loader request="frontend architecture and patterns" category="frontend" list_only="true"
   ```

   **If feature appears full-stack or unclear**:
   ```bash
   context-loader request="backend architecture and patterns" category="backend" list_only="true"
   context-loader request="frontend architecture and patterns" category="frontend" list_only="true"
   ```

3. **Review and load only relevant docs**:
   - Review the returned document list (IDs, titles, summaries, token estimates)
   - Identify which specific documents are relevant to the planned feature
   - Load only those documents:
   ```bash
   context-loader request="load specific documents" ids="1,2,5" list_only="false"
   ```

**Fallback:** If context-loader agent is not available or fails, use:
```bash
/load-context both
```

**Benefits:** Planning phase only needs high-level architecture docs, not detailed implementation guides. Selective loading saves tokens.

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

### Step 6: Build All Sections (Parallel Execution)

**CRITICAL**: Use parallel execution to build multiple sections simultaneously when dependencies allow.

Loop until all sections are completed:

**Query for ALL buildable sections:**
```sql
SELECT s.id, s.name FROM sections s
WHERE s.feature_id = ? AND s.status = 'pending'
AND (s.depends_on IS NULL OR s.depends_on IN
    (SELECT id FROM sections WHERE status = 'completed'))
ORDER BY s.order_index;
```

**If no buildable sections found:**
- Check if any sections are still `in_progress` (waiting for agents to finish)
- Check if any sections are stuck in `pending` (potential circular dependency)
- If all done, exit loop
- If stuck, log error and report to user

**Mark ALL buildable sections as in_progress:**
For each buildable section:
```sql
UPDATE sections SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
WHERE id = ?;
```

**Launch ALL section builders IN PARALLEL:**
**CRITICAL**: You MUST launch all agents in a SINGLE message with multiple Task tool calls.

Example for 3 buildable sections:
```
I'll now build sections 1, 2, and 3 in parallel.

[Task tool call for section 1]
[Task tool call for section 2]
[Task tool call for section 3]
```

Each agent receives:
- section_id: {section_id}
- planning_document_path: docs/plans/{FEATURE}/PLANNING.md

**Wait for all agents to complete** (automatic - Claude Code handles this)

**Verify completions:**
For each section that was launched:
```sql
SELECT status, notes FROM sections WHERE id = ?;
```

If any section is still 'in_progress':
- Log error to error_log table
- Report to user with agent details
- Ask user: retry, skip, or abort?

**Create batch commit (optional):**
After each parallel batch completes successfully:
```bash
git add .
git commit -m "Implement {feature-name}: {comma-separated section names}

{brief description of what was implemented in this batch}

Sections completed:
- {section-1-name}
- {section-2-name}
- {section-n-name}

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Repeat** - Next iteration will find newly unblocked sections and launch them in parallel.

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

**Circular dependency detected:**
- Query for stuck sections: `SELECT id, name, depends_on FROM sections WHERE feature_id = ? AND status = 'pending'`
- Check if no sections are buildable but some are pending
- Report dependency chain to user
- Ask user to fix PLANNING.md and re-insert sections

**Parallel execution stalls:**
- If multiple iterations with no progress (same sections pending)
- Check for sections stuck in 'in_progress' (agents may have crashed)
- Offer to reset stuck sections to 'pending' and retry

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

### Example 3: Complex Feature (3 Sections with Dependencies)
```bash
/plan multi-tenant "Add multi-tenant support with isolation"
```

Creates:
- Section 1: "tenant-data-model" (depends_on: NULL)
- Section 2: "tenant-ui" (depends_on: 1)
- Section 3: "tenant-permissions" (depends_on: NULL)

Execution:
- **Iteration 1**: Launches sections 1 and 3 in parallel (no dependencies)
- **Iteration 2**: After 1 completes, launches section 2 (dependency satisfied)
- Total time: ~2 iterations instead of 3 sequential

## Notes

- This command replaces: `/start-plan`, `/create-plan`, `/build`, `/complete-plan`
- Uses database-driven context loading instead of prime commands
- Minimizes user questions - just feature description
- Automatically progresses through all sections
- Creates commits after each section (configurable)
- Runs quality checks before marking complete
