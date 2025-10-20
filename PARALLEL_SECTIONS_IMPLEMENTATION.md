# Parallel Section Building - Implementation Summary

## Overview

CADI now supports running multiple `plan-section-builder` agents in parallel while respecting section dependencies and coordinating through project.db.

## Key Changes

### 1. Design Documentation
**File:** `docs/design/PARALLEL_SECTION_BUILDING.md`

Comprehensive design covering:
- Database coordination strategy
- Query patterns for finding buildable sections
- Parallel launch patterns
- Dependency resolution (tree, linear, fully parallel)
- Edge case handling (failures, circular dependencies, timeouts)
- Example execution scenarios

### 2. Enhanced /plan Command
**File:** `base-claude/commands/cadi/planning/plan.md`

**Changes:**
- Step 6 rewritten to query for ALL buildable sections (not just one)
- Launches multiple agents in single message with multiple Task tool calls
- Handles partial failures gracefully
- Added circular dependency detection
- Added stuck section detection
- Enhanced edge case handling in Edge Cases section
- Updated examples to show parallel execution timing

**Key Query:**
```sql
SELECT s.id, s.name FROM sections s
WHERE s.feature_id = ? AND s.status = 'pending'
AND (s.depends_on IS NULL OR s.depends_on IN
    (SELECT id FROM sections WHERE status = 'completed'))
ORDER BY s.order_index;
```

This returns ALL sections that can be built right now (dependencies met).

### 3. Updated plan-section-builder Agent
**File:** `base-claude/agents/cadi/planning/plan-section-builder.md`

**Changes:**
- Added Core Rule #6: Stateless Operation
- Added warning about parallel execution
- Emphasized database coordination
- No shared state or locks

### 4. New /plan-debug Command
**File:** `base-claude/commands/cadi/planning/plan-debug.md`

Utility for managing stuck sections:
- **Status** (default): Show detailed section status, stuck sections, blocked sections
- **Reset [section-id]**: Reset a stuck section to pending
- **Reset-all**: Reset all in_progress sections
- **Detect-cycles**: Find circular dependencies

### 5. Testing Documentation
**File:** `docs/testing/PARALLEL_SECTION_BUILDING_TESTS.md`

Six comprehensive test scenarios:
1. Fully parallel (no dependencies)
2. Linear dependencies (sequential)
3. Tree dependencies (mixed parallel/sequential)
4. Circular dependency detection
5. Partial failure recovery
6. Long-running agent handling

Includes verification queries and success metrics.

## How It Works

### Coordination Mechanism

**Database Status as Lock:**
- `pending`: Available to be picked up
- `in_progress`: Currently being worked on by an agent
- `completed`: Done, can unblock dependent sections

**Dependency Tracking:**
- `sections.depends_on`: Foreign key to another section
- `NULL`: No dependencies, can start immediately
- `<section_id>`: Must wait for that section to complete

### Execution Flow

```
Loop until all sections completed:
  1. Query for ALL buildable sections (dependencies met, status=pending)
  2. If none found:
     - Check if any in_progress (waiting)
     - Check if circular dependency (stuck)
     - Exit if all completed
  3. Mark ALL buildable as in_progress (atomic)
  4. Launch ALL in single message (multiple Task tool calls)
  5. Wait for completions
  6. Verify all marked completed
  7. Handle any failures
  8. Repeat (finds newly unblocked sections)
```

### Parallel Launch Pattern

**CRITICAL:** All agents must be launched in a SINGLE message:

```
I'll now build sections 1, 2, and 3 in parallel.

[Task tool: plan-section-builder, section_id: 1]
[Task tool: plan-section-builder, section_id: 2]
[Task tool: plan-section-builder, section_id: 3]
```

This ensures Claude Code processes them in parallel, not sequentially.

## Benefits

### Performance Improvements

| Scenario | Sequential | Parallel | Speedup |
|----------|-----------|----------|---------|
| 3 independent sections | 3 units | 1 unit | 3x |
| Tree (5 sections) | 5 units | 3 units | 1.67x |
| Linear (3 sections) | 3 units | 3 units | 1x (expected) |

### Resource Utilization
- Multiple agents can work simultaneously
- Better utilization of Claude Code's parallel processing
- Reduced total wall-clock time for features

### Reliability
- Partial failures don't block other sections
- Stuck sections can be detected and reset
- Circular dependencies detected early

## Database Schema

### Existing Tables (Used)

```sql
CREATE TABLE features (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  status TEXT CHECK(status IN ('planning', 'ready', 'in_progress', 'testing', 'completed'))
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed')),
  depends_on INTEGER,  -- FK to sections.id
  order_index INTEGER NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (depends_on) REFERENCES sections(id)
);

CREATE TABLE error_log (
  -- For tracking failures
);

CREATE TABLE agent_invocations (
  -- For monitoring agent activity
);
```

### No Schema Changes Required

The existing schema in SchemaManager.js (version 7) already supports:
- Dependency tracking (`depends_on`)
- Status transitions
- Timing data
- Error logging

## Usage Examples

### Example 1: Simple Feature (3 Independent Sections)

```bash
/plan email-notifications
```

**Execution:**
- Creates 3 sections (no dependencies)
- Iteration 1: Launches all 3 in parallel
- All complete simultaneously
- Feature marked completed

### Example 2: Complex Feature (Tree Structure)

```bash
/plan dashboard
```

**PLANNING.md sections:**
- database (no deps)
- api-users (depends on database)
- api-posts (depends on database)
- ui (no deps)
- integration (depends on api-users, api-posts, ui)

**Execution:**
- Iteration 1: database, ui (2 parallel)
- Iteration 2: api-users, api-posts (2 parallel)
- Iteration 3: integration (1)
- Total: 3 iterations vs 5 if sequential

### Example 3: Debug Stuck Section

```bash
# Start building
/plan user-auth

# Section seems stuck
/plan-debug user-auth
# Shows: Section 2 in_progress for 2 hours

# Reset stuck section
/plan-debug user-auth reset 2

# Resume
/plan user-auth
```

## Edge Cases Handled

### 1. Agent Crashes
- Section stays `in_progress`
- `/plan-debug` detects (time-based)
- User can reset to `pending`
- Retry with `/plan`

### 2. Circular Dependencies
- Query returns no buildable sections
- All remaining are `pending` with unmet deps
- `/plan-debug detect-cycles` finds cycle
- User fixes PLANNING.md and re-inserts

### 3. Partial Failures
- Some agents complete, others fail
- Next iteration only launches new buildable sections
- User can retry failed sections individually

### 4. Long-Running Agents
- Other sections complete first
- Next iteration finds newly unblocked sections
- No artificial timeouts

## Monitoring

### Check Section Status
```sql
SELECT s.id, s.name, s.status, s.depends_on,
       ROUND((julianday('now') - julianday(s.started_at)) * 24, 2) as hours_in_progress
FROM sections s
WHERE s.feature_id = ?
ORDER BY s.order_index;
```

### Check for Stuck Sections
```sql
SELECT id, name, started_at
FROM sections
WHERE feature_id = ?
  AND status = 'in_progress'
  AND julianday('now') - julianday(started_at) > 0.042;  -- 1 hour
```

### View in cadi-monitor
The cadi-monitor UI shows:
- Agent activity in real-time
- Section status updates
- Error log entries
- Timing data

## Future Enhancements (Optional)

### Multiple Dependencies
Current: Each section has 0 or 1 dependency
Future: Support multiple dependencies per section

**Options:**
1. JSON array in `depends_on` field
2. Separate `section_dependencies` junction table

**Query pattern:**
```sql
-- Check ALL dependencies are completed
WHERE NOT EXISTS (
  SELECT 1 FROM json_each(s.depends_on) AS dep
  WHERE dep.value NOT IN (SELECT id FROM sections WHERE status = 'completed')
)
```

### Max Parallel Limit
Add config to limit concurrent agents:
```javascript
const MAX_PARALLEL = 5;
const buildableSections = allBuildable.slice(0, MAX_PARALLEL);
```

### Priority Scheduling
Use `sections.order_index` or new `priority` field to order buildable sections:
```sql
ORDER BY s.priority DESC, s.order_index;
```

### Resource Estimation
Track token usage per section:
```sql
ALTER TABLE sections ADD COLUMN estimated_tokens INTEGER;
ALTER TABLE sections ADD COLUMN actual_tokens INTEGER;
```

Balance parallel launches by total tokens:
```javascript
let totalTokens = 0;
for (const section of buildable) {
  if (totalTokens + section.estimated_tokens > MAX_TOKENS) break;
  launch(section);
  totalTokens += section.estimated_tokens;
}
```

## Files Changed

1. `docs/design/PARALLEL_SECTION_BUILDING.md` (NEW)
2. `base-claude/commands/cadi/planning/plan.md` (MODIFIED)
3. `base-claude/agents/cadi/planning/plan-section-builder.md` (MODIFIED)
4. `base-claude/commands/cadi/planning/plan-debug.md` (NEW)
5. `docs/testing/PARALLEL_SECTION_BUILDING_TESTS.md` (NEW)

## Testing Checklist

- [ ] Test Scenario 1: Fully parallel (3 independent sections)
- [ ] Test Scenario 2: Linear dependencies (3 sequential sections)
- [ ] Test Scenario 3: Tree dependencies (mixed parallel)
- [ ] Test Scenario 4: Circular dependency detection
- [ ] Test Scenario 5: Partial failure recovery
- [ ] Test Scenario 6: Long-running agent
- [ ] Verify `/plan-debug` status display
- [ ] Verify `/plan-debug reset` functionality
- [ ] Verify `/plan-debug detect-cycles`
- [ ] Check agent_invocations table populated correctly
- [ ] Check error_log for coordination issues
- [ ] Monitor via cadi-monitor UI during parallel execution

## Migration Notes

**No Database Migration Required**

The existing schema (version 7) already supports all features:
- `sections.depends_on` exists
- `sections.status` has correct values
- `sections.started_at/completed_at` exist
- All tables and indexes present

**No Code Changes for Existing Features**

Features created before this change will work:
- Old sequential behavior still valid (launches 1 at a time)
- New behavior is backward compatible
- Database coordination is the same

**User Education**

Users should know:
1. Sections can now build in parallel
2. Dependencies control execution order
3. Use `/plan-debug` if things get stuck
4. Check cadi-monitor for real-time progress

## Performance Expectations

### Best Case (Fully Parallel)
- N independent sections
- Time: ~1 iteration
- Speedup: Nx

### Worst Case (Linear Dependencies)
- N sections in chain
- Time: N iterations
- Speedup: 1x (same as before)

### Typical Case (Mixed)
- N sections with partial dependencies
- Time: between 1 and N iterations
- Speedup: 1.5x to 3x

## Troubleshooting

### Problem: Sections stuck in pending
**Cause:** Unmet dependencies or circular dependency
**Solution:** Run `/plan-debug {feature} detect-cycles`

### Problem: Sections stuck in in_progress
**Cause:** Agent crashed or very long running
**Solution:** Run `/plan-debug {feature}` to see timing, reset if needed

### Problem: /plan does nothing
**Cause:** No buildable sections (all in_progress or have unmet deps)
**Solution:** Wait for in_progress to complete, or debug stuck sections

### Problem: Same section launched twice
**Cause:** Status not updated to in_progress before launch
**Solution:** This shouldn't happen - check /plan implementation

## Support

For issues:
1. Check `/plan-debug {feature}` first
2. Query database directly to verify state
3. Check error_log table for logged errors
4. View agent_invocations for timing
5. Monitor cadi-monitor for real-time state

## Summary

CADI can now build multiple plan sections in parallel when dependencies allow, using project.db for coordination. This significantly speeds up feature implementation for features with independent or tree-structured sections, while maintaining reliability through database-driven state management and comprehensive error handling.
