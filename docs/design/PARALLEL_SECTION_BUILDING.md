# Parallel Section Building Design

## Overview

Enable CADI to run multiple `plan-section-builder` agents in parallel while respecting section dependencies and coordinating through project.db.

## Key Requirements

1. **Parallel Execution**: Launch multiple section builders simultaneously when possible
2. **Dependency Management**: Respect `sections.depends_on` relationships
3. **Database Coordination**: Use project.db as single source of truth for status
4. **No Conflicts**: Prevent race conditions and duplicate work
5. **Graceful Handling**: Deal with partial failures without blocking other sections

## Database Schema

### Existing Tables (SchemaManager.js)

```sql
-- Features table tracks overall feature status
CREATE TABLE features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  planning_doc_path TEXT NOT NULL,
  summary TEXT,
  status TEXT CHECK(status IN ('planning', 'ready', 'in_progress', 'testing', 'completed')),
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Sections table with dependency tracking
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  objectives TEXT,                    -- JSON array
  verification_criteria TEXT,         -- JSON array
  order_index INTEGER NOT NULL,       -- Display order
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed')),
  depends_on INTEGER,                 -- FK to sections.id (dependency)
  estimated_hours REAL,
  actual_hours REAL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on) REFERENCES sections(id)
);
```

### Key Fields for Coordination

- **sections.status**: Atomic state machine
  - `pending`: Not started, dependencies may not be met
  - `in_progress`: Agent is actively working on it
  - `completed`: Done, other sections can depend on it

- **sections.depends_on**: Optional foreign key to another section
  - `NULL`: No dependencies, can start immediately
  - `<section_id>`: Must wait for that section to be `completed`

- **sections.started_at/completed_at**: Timing data for monitoring

## Coordination Strategy

### Query for Buildable Sections

```sql
-- Get ALL sections that can be built right now
SELECT s.id, s.name, s.feature_id
FROM sections s
WHERE s.feature_id = ?
  AND s.status = 'pending'
  AND (
    s.depends_on IS NULL
    OR s.depends_on IN (
      SELECT id FROM sections WHERE status = 'completed'
    )
  )
ORDER BY s.order_index;
```

This query returns:
- All `pending` sections
- That either have no dependencies OR whose dependencies are `completed`
- Ordered by `order_index` for consistent processing

### Parallel Launch Pattern

```javascript
// Pseudocode for /plan command Step 6

while (true) {
  // 1. Get all buildable sections
  const buildableSections = db.query(`
    SELECT s.id, s.name FROM sections s
    WHERE s.feature_id = ? AND s.status = 'pending'
    AND (s.depends_on IS NULL OR s.depends_on IN
        (SELECT id FROM sections WHERE status = 'completed'))
    ORDER BY s.order_index
  `);

  if (buildableSections.length === 0) {
    break; // All done or waiting on in_progress sections
  }

  // 2. Mark all as in_progress ATOMICALLY
  for (const section of buildableSections) {
    db.exec(`
      UPDATE sections
      SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, section.id);
  }

  // 3. Launch ALL agents in parallel (single message, multiple tool calls)
  // This is CRITICAL - must be in ONE message to Claude Code
  for (const section of buildableSections) {
    Task tool: plan-section-builder
      - section_id: section.id
      - planning_document_path: docs/plans/{feature}/PLANNING.md
  }

  // 4. Wait for ALL agents to complete
  // (Claude Code will handle this automatically)

  // 5. Verify completions and handle failures
  for (const section of buildableSections) {
    const status = db.query(`SELECT status FROM sections WHERE id = ?`, section.id);
    if (status !== 'completed') {
      // Agent failed - log error, ask user
      // Option to retry, skip, or abort
    }
  }

  // 6. Loop to check for newly unblocked sections
}
```

### Handling Edge Cases

**Case 1: Agent fails to mark section complete**
- Query after agent returns: `SELECT status FROM sections WHERE id = ?`
- If still `in_progress`: Ask user to retry or skip
- Log to error_log table

**Case 2: Partial failure in parallel batch**
- Some sections complete, others fail
- Next iteration will only launch new buildable sections
- Failed sections stay `in_progress` until resolved

**Case 3: Circular dependencies**
- Should be prevented at planning time
- Detection: If no sections are buildable but some are `pending`, log warning
- Query: `SELECT id, name, depends_on FROM sections WHERE status = 'pending'`

**Case 4: Long-running agents**
- Normal behavior - other sections can complete first
- Next iteration will find newly unblocked sections
- No timeout needed - let agent finish naturally

## Example Scenarios

### Scenario 1: No Dependencies (Fully Parallel)

```
Feature: Multi-tenant Support
Sections:
  1. tenant-data-model (depends_on: NULL)
  2. tenant-ui (depends_on: NULL)
  3. tenant-api (depends_on: NULL)

Execution:
  Iteration 1:
    - Query finds: [1, 2, 3] (all buildable)
    - Mark all as in_progress
    - Launch 3 agents in parallel
    - All complete
  Iteration 2:
    - Query finds: [] (none pending)
    - Exit loop
```

### Scenario 2: Linear Dependencies (Sequential)

```
Feature: User Authentication
Sections:
  1. auth-backend (depends_on: NULL)
  2. auth-frontend (depends_on: 1)
  3. auth-tests (depends_on: 2)

Execution:
  Iteration 1:
    - Query finds: [1] (only 1 buildable)
    - Launch 1 agent
    - Completes
  Iteration 2:
    - Query finds: [2] (1 is completed, unblocks 2)
    - Launch 1 agent
    - Completes
  Iteration 3:
    - Query finds: [3] (2 is completed, unblocks 3)
    - Launch 1 agent
    - Completes
```

### Scenario 3: Tree Dependencies (Mixed Parallel)

```
Feature: Dashboard
Sections:
  1. dashboard-backend (depends_on: NULL)
  2. dashboard-widgets (depends_on: 1)
  3. dashboard-charts (depends_on: 1)
  4. dashboard-layout (depends_on: NULL)
  5. dashboard-integration (depends_on: 2, 3, 4)

Execution:
  Iteration 1:
    - Query finds: [1, 4] (no dependencies)
    - Launch 2 agents in parallel
    - Both complete
  Iteration 2:
    - Query finds: [2, 3] (1 is completed, unblocks both)
    - Launch 2 agents in parallel
    - Both complete
  Iteration 3:
    - Query finds: [5] (2, 3, 4 all completed)
    - Launch 1 agent
    - Completes
```

Note: Section 5 depends on multiple sections. SQL handles this:
```sql
-- This works for multiple dependencies (comma-separated IDs)
depends_on IN (SELECT id FROM sections WHERE status = 'completed')
```

But current schema only supports ONE depends_on value. For multiple dependencies, we need to enhance the schema.

## Schema Enhancement (Optional)

To support multiple dependencies per section:

### Option A: JSON Array in depends_on
```sql
-- Store as JSON array: "[1, 2, 3]"
depends_on TEXT  -- JSON array of section IDs

-- Query with JSON functions (SQLite 3.38+)
WHERE s.status = 'pending'
  AND (
    s.depends_on IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM json_each(s.depends_on) AS dep
      WHERE dep.value NOT IN (
        SELECT id FROM sections WHERE status = 'completed'
      )
    )
  )
```

### Option B: Separate Junction Table
```sql
CREATE TABLE section_dependencies (
  section_id INTEGER NOT NULL,
  depends_on_section_id INTEGER NOT NULL,
  PRIMARY KEY (section_id, depends_on_section_id),
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- Query for buildable sections
WHERE s.status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM section_dependencies sd
    JOIN sections dep ON sd.depends_on_section_id = dep.id
    WHERE sd.section_id = s.id
      AND dep.status != 'completed'
  )
```

**Recommendation**: Keep current schema for simplicity. Most sections have 0 or 1 dependency. For complex features, break into sub-features.

## Implementation Checklist

- [x] Document parallel building design
- [ ] Update /plan command (Step 6) to query for ALL buildable sections
- [ ] Update /plan command to launch multiple agents in single message
- [ ] Update /plan command to handle partial failures gracefully
- [ ] Add error logging for coordination failures
- [ ] Add circular dependency detection
- [ ] Test with various dependency patterns
- [ ] Document usage examples in /plan command
- [ ] Update plan-section-builder to be stateless (no shared state assumptions)

## Notes

- **Critical**: Launch agents in SINGLE message with multiple Task tool calls
- Database status is the ONLY coordination mechanism - no file locks or external state
- Agent failures should not block other sections
- Circular dependency detection is important for user experience
- Consider adding `max_parallel_sections` config if resource constraints are a concern
