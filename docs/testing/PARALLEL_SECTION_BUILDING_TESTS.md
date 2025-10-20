# Parallel Section Building - Test Scenarios

## Overview

This document outlines test scenarios for validating parallel section building with dependency management.

## Test Setup

### Prerequisites

1. Database initialized: `.claude/project.db` with schema version 7+
2. Context documents indexed
3. Clean git state (or test branch)

### Database Verification

```bash
sqlite3 .claude/project.db "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
# Should return: 7
```

## Test Scenarios

### Scenario 1: Fully Parallel (No Dependencies)

**Setup:**
Create a feature with 3 independent sections.

**PLANNING.md:**
```markdown
# Test Feature - Parallel

## Summary
Test fully parallel section execution.

## Sections

### section-1
**Description:** Independent section 1
**Objectives:**
- Create file1.js with export function test1()
**Verification:**
- File exists and exports test1

### section-2
**Description:** Independent section 2
**Objectives:**
- Create file2.js with export function test2()
**Verification:**
- File exists and exports test2

### section-3
**Description:** Independent section 3
**Objectives:**
- Create file3.js with export function test3()
**Verification:**
- File exists and exports test3
```

**Database setup:**
```sql
INSERT INTO features (name, planning_doc_path, summary, status)
VALUES ('test-parallel', 'docs/plans/test-parallel/PLANNING.md', 'Test parallel', 'ready');

-- Get feature_id
SELECT id FROM features WHERE name = 'test-parallel';

-- Insert sections (no dependencies)
INSERT INTO sections (feature_id, name, description, objectives, verification_criteria, order_index, status)
VALUES
  (1, 'section-1', 'Independent section 1', '["Create file1.js with export function test1()"]', '["File exists and exports test1"]', 0, 'pending'),
  (1, 'section-2', 'Independent section 2', '["Create file2.js with export function test2()"]', '["File exists and exports test2"]', 1, 'pending'),
  (1, 'section-3', 'Independent section 3', '["Create file3.js with export function test3()"]', '["File exists and exports test3"]', 2, 'pending');
```

**Execution:**
```bash
/plan test-parallel
```

**Expected Behavior:**
1. First iteration queries all 3 sections (all buildable)
2. Marks all 3 as `in_progress`
3. Launches 3 `plan-section-builder` agents in **single message**
4. All 3 complete simultaneously
5. Second iteration finds no pending sections
6. Feature marked completed

**Verification:**
```sql
SELECT name, status, started_at, completed_at FROM sections WHERE feature_id = 1;
```

All should be `completed` with similar timestamps.

**Success Criteria:**
- All 3 agents launched in parallel (1 message, 3 tool calls)
- All 3 files created (file1.js, file2.js, file3.js)
- Total time < 2x single section time

---

### Scenario 2: Linear Dependencies (Sequential)

**Setup:**
Create feature with chain of dependencies.

**PLANNING.md:**
```markdown
# Test Feature - Sequential

## Summary
Test sequential section execution with dependencies.

## Sections

### backend
**Description:** Backend API
**Objectives:**
- Create api.js with function getData()
**Verification:**
- api.js exists

### frontend
**Description:** Frontend that calls API
**Objectives:**
- Create ui.js that imports api.js
**Verification:**
- ui.js exists and imports api.js

### tests
**Description:** Tests for both
**Objectives:**
- Create tests.js that imports api.js and ui.js
**Verification:**
- tests.js exists and imports both
```

**Database setup:**
```sql
INSERT INTO features (name, planning_doc_path, summary, status)
VALUES ('test-sequential', 'docs/plans/test-sequential/PLANNING.md', 'Test sequential', 'ready');

-- Sections with dependencies
INSERT INTO sections (feature_id, name, description, objectives, verification_criteria, order_index, depends_on, status)
VALUES
  (2, 'backend', 'Backend API', '["Create api.js with function getData()"]', '["api.js exists"]', 0, NULL, 'pending'),
  (2, 'frontend', 'Frontend', '["Create ui.js that imports api.js"]', '["ui.js exists and imports api.js"]', 1, 1, 'pending'),
  (2, 'tests', 'Tests', '["Create tests.js that imports api.js and ui.js"]', '["tests.js exists and imports both"]', 2, 2, 'pending');
```

Note: Section 2 depends_on section 1, section 3 depends_on section 2.

**Execution:**
```bash
/plan test-sequential
```

**Expected Behavior:**
1. Iteration 1: Finds section 1 (no dependencies)
2. Launches 1 agent
3. Section 1 completes
4. Iteration 2: Finds section 2 (dependency met)
5. Launches 1 agent
6. Section 2 completes
7. Iteration 3: Finds section 3 (dependency met)
8. Launches 1 agent
9. Section 3 completes

**Success Criteria:**
- Sections execute in order: 1 → 2 → 3
- Each waits for previous to complete
- All files created with correct imports

---

### Scenario 3: Tree Dependencies (Mixed)

**Setup:**
Feature with parallel branches that merge.

**PLANNING.md:**
```markdown
# Test Feature - Tree

## Summary
Test tree-shaped dependencies.

## Sections

### database
**Description:** Database setup
**Objectives:**
- Create db.js
**Verification:**
- db.js exists

### api-users
**Description:** Users API (depends on database)
**Objectives:**
- Create api-users.js that imports db.js
**Verification:**
- api-users.js exists

### api-posts
**Description:** Posts API (depends on database)
**Objectives:**
- Create api-posts.js that imports db.js
**Verification:**
- api-posts.js exists

### ui
**Description:** UI (independent)
**Objectives:**
- Create ui.js
**Verification:**
- ui.js exists

### integration
**Description:** Integration (depends on all APIs and UI)
**Objectives:**
- Create app.js that imports all modules
**Verification:**
- app.js exists and imports all 4 modules
```

**Database setup:**
```sql
INSERT INTO features (name, planning_doc_path, summary, status)
VALUES ('test-tree', 'docs/plans/test-tree/PLANNING.md', 'Test tree', 'ready');

-- Tree structure:
--     db(1)    ui(4)
--     /  \       |
--   u(2) p(3)   |
--     \   |    /
--      integration(5)

INSERT INTO sections (feature_id, name, description, objectives, verification_criteria, order_index, depends_on, status)
VALUES
  (3, 'database', 'Database', '["Create db.js"]', '["db.js exists"]', 0, NULL, 'pending'),
  (3, 'api-users', 'Users API', '["Create api-users.js that imports db.js"]', '["api-users.js exists"]', 1, 1, 'pending'),
  (3, 'api-posts', 'Posts API', '["Create api-posts.js that imports db.js"]', '["api-posts.js exists"]', 2, 1, 'pending'),
  (3, 'ui', 'UI', '["Create ui.js"]', '["ui.js exists"]', 3, NULL, 'pending'),
  (3, 'integration', 'Integration', '["Create app.js that imports all modules"]', '["app.js exists and imports all 4 modules"]', 4, 2, 'pending');
```

Note: Simplified - section 5 depends only on section 2, but in practice should check all are done.

**Expected Behavior:**
1. **Iteration 1**: Finds sections 1, 4 (no dependencies)
   - Launches 2 agents in parallel
   - Both complete
2. **Iteration 2**: Finds sections 2, 3 (dependency 1 met)
   - Launches 2 agents in parallel
   - Both complete
3. **Iteration 3**: Finds section 5 (all dependencies met)
   - Launches 1 agent
   - Completes

**Success Criteria:**
- Parallel execution in iterations 1 and 2
- Total iterations: 3 (vs 5 if sequential)
- All files created with correct imports

---

### Scenario 4: Circular Dependency Detection

**Setup:**
Create feature with circular dependency to test detection.

**Database setup:**
```sql
INSERT INTO features (name, planning_doc_path, summary, status)
VALUES ('test-circular', 'docs/plans/test-circular/PLANNING.md', 'Test circular', 'ready');

-- Create circular dependency: 1 -> 2 -> 3 -> 1
INSERT INTO sections (feature_id, name, description, objectives, verification_criteria, order_index, depends_on, status)
VALUES
  (4, 'section-1', 'Section 1', '["Task 1"]', '["Done"]', 0, 3, 'pending'),
  (4, 'section-2', 'Section 2', '["Task 2"]', '["Done"]', 1, 1, 'pending'),
  (4, 'section-3', 'Section 3', '["Task 3"]', '["Done"]', 2, 2, 'pending');
```

**Execution:**
```bash
/plan test-circular
```

**Expected Behavior:**
1. Query for buildable sections returns empty (all have unmet dependencies)
2. Detect no progress can be made
3. Run detection query to find cycle
4. Report to user with dependency chain
5. Ask user to fix

**Success Criteria:**
- No agents launched
- Error logged to error_log table
- Clear user message explaining circular dependency
- Suggestion to use `/plan-debug test-circular detect-cycles`

---

### Scenario 5: Partial Failure Recovery

**Setup:**
Create feature where one section fails mid-execution.

**Execution:**
1. Start `/plan` with 3 parallel sections
2. Simulate one agent failing (manually set section back to `in_progress` in database)
3. Use `/plan-debug` to detect and reset stuck section
4. Resume execution

**Database simulation:**
```sql
-- After first iteration starts
UPDATE sections SET status = 'in_progress' WHERE id = 2;
-- (simulates agent crash - doesn't mark completed)
```

**Expected Behavior:**
1. Iterations 1 completes sections 1, 3 but not 2
2. Next iteration finds no buildable sections (2 is in_progress)
3. User runs `/plan-debug {feature}`
4. Shows section 2 stuck in_progress
5. User runs `/plan-debug {feature} reset 2`
6. Section 2 reset to pending
7. Resume `/plan {feature}`
8. Section 2 builds successfully

**Success Criteria:**
- Partial failure doesn't block other sections
- Debug command correctly identifies stuck section
- Reset and retry works
- Feature completes after recovery

---

### Scenario 6: Agent Timeout/Long Running

**Setup:**
Create feature where one section takes much longer than others.

**Expected Behavior:**
1. Launch 3 sections in parallel
2. Sections 1, 3 complete quickly
3. Section 2 takes 10+ minutes
4. Next iteration finds no new buildable sections (waiting on section 2)
5. Eventually section 2 completes
6. Dependent sections unblock and execute

**Success Criteria:**
- System waits gracefully for long-running agents
- No timeout errors
- Dependent sections start immediately after completion

---

## Verification Queries

### Check Section Status
```sql
SELECT s.id, s.name, s.status, s.depends_on,
       s2.name as depends_on_name,
       s2.status as depends_on_status
FROM sections s
LEFT JOIN sections s2 ON s.depends_on = s2.id
WHERE s.feature_id = ?
ORDER BY s.order_index;
```

### Check for Buildable Sections
```sql
SELECT s.id, s.name FROM sections s
WHERE s.feature_id = ?
  AND s.status = 'pending'
  AND (s.depends_on IS NULL OR s.depends_on IN
      (SELECT id FROM sections WHERE status = 'completed'))
ORDER BY s.order_index;
```

### Check Timing
```sql
SELECT name,
       ROUND((julianday(completed_at) - julianday(started_at)) * 24, 2) as hours
FROM sections
WHERE feature_id = ?
  AND status = 'completed';
```

### Check Parallel Execution
```sql
SELECT name, started_at
FROM sections
WHERE feature_id = ?
ORDER BY started_at;
```

If multiple sections have the same `started_at`, they ran in parallel.

## Cleanup After Tests

```sql
-- Remove test features
DELETE FROM features WHERE name LIKE 'test-%';

-- Verify cleanup
SELECT COUNT(*) FROM sections;
SELECT COUNT(*) FROM features;
```

## Success Metrics

| Scenario | Metric | Target |
|----------|--------|--------|
| Fully Parallel | Iterations | 1-2 |
| Fully Parallel | Time vs Sequential | < 40% |
| Linear Dependencies | Iterations | # sections |
| Tree Dependencies | Iterations | < # sections |
| Circular Dependency | Detection | Immediate |
| Partial Failure | Recovery | Success |

## Notes

- Run tests on separate branch or test database
- Monitor `.claude/project.db` with cadi-monitor during tests
- Check error_log table after each test
- Verify agent_invocations and agent_completions tables
