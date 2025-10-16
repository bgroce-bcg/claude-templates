# CADI Monitor - Agent Logging Integration

## Summary

Added complete agent invocation logging and visualization support to cadi-monitor web UI.

## Backend Changes

### 1. ProjectMonitor.js

Added two new methods for querying agent activity:

**`getAgentInvocations(options)`**
- Queries `agent_invocations` and `agent_completions` tables
- Joins with `features` and `sections` for context
- Filter options:
  - `limit` - Max results (default: 50)
  - `agentType` - Filter by agent type (e.g., "Explore", "general-purpose")
  - `sessionId` - Filter by Claude session ID
  - `featureId` - Filter by feature
  - `parentAgent` - Filter by parent agent (for nesting analysis)
- Returns full invocation data with timing and completion status

**`getAgentStats()`**
- Aggregates statistics across all agent invocations
- Returns:
  - Total invocations
  - Breakdown by agent type with avg/min/max duration
  - Completed vs in-progress counts
  - Overall average and total duration

### 2. server.js

Added new API endpoint:

**`GET /api/projects/:id/agent-invocations`**
- Query parameters:
  - `limit` - Max results
  - `type` - Agent type filter
  - `session` - Session ID filter
  - `feature` - Feature ID filter
  - `parent` - Parent agent filter
- Returns:
  ```json
  {
    "invocations": [...], // Array of invocation records
    "stats": {...}        // Aggregate statistics
  }
  ```

### 3. UpdateManager.js

Enhanced to track and update `settings.json`:

**Analysis Phase:**
- Checks if `settings.json` exists in template (`base-claude/.claude/settings.json`)
- Compares with project's `.claude/settings.json`
- Reports as added, modified, or unchanged

**Apply Phase:**
- Copies `settings.json` from template to project during updates
- Handles correct path resolution (template is in `base-claude/.claude/`)
- Preserves existing file during backup

This means when you run **Update Project** in cadi-monitor, it will now also update the hooks configuration automatically!

## API Usage Examples

### Get Recent Agent Activity

```bash
curl http://localhost:3030/api/projects/my-project/agent-invocations?limit=15
```

### Filter by Agent Type

```bash
curl http://localhost:3030/api/projects/my-project/agent-invocations?type=Explore&limit=25
```

### Filter by Feature

```bash
curl http://localhost:3030/api/projects/my-project/agent-invocations?feature=1&limit=50
```

### Filter by Session (for tracing agent chains)

```bash
curl http://localhost:3030/api/projects/my-project/agent-invocations?session=abc123
```

## Data Structure

### Invocation Record
```json
{
  "id": 1,
  "agent_type": "Explore",
  "agent_prompt": "Find all error handling patterns",
  "agent_description": "Search codebase for patterns",
  "session_id": "abc123",
  "parent_agent": null,
  "feature_id": 5,
  "section_id": 12,
  "invoked_at": "2025-10-16T10:30:00.000Z",
  "completed_at": "2025-10-16T10:30:15.000Z",
  "duration_ms": 15000,
  "success": 1,
  "error_message": null,
  "feature_name": "error-handling",
  "section_name": "audit-patterns"
}
```

### Stats Object
```json
{
  "total": 47,
  "byType": {
    "Explore": {
      "count": 25,
      "avgDuration": 8500,
      "minDuration": 2000,
      "maxDuration": 18000
    },
    "general-purpose": {
      "count": 22,
      "avgDuration": 45000,
      "minDuration": 15000,
      "maxDuration": 120000
    }
  },
  "completed": 45,
  "inProgress": 2,
  "avgDuration": 25000,
  "totalDuration": 1125000
}
```

## UI Integration (Next Steps)

To add agent activity visualization to the web UI:

### 1. Add Navigation Tab

In `public/index.html`, add a new tab next to "Errors" and "Context Loads":

```html
<button class="tab-button" data-tab="agents">Agent Activity</button>
```

### 2. Create Agent Activity Section

```html
<div id="agents-tab" class="tab-content">
  <div class="section-header">
    <h2>Agent Invocations</h2>
    <div class="filter-controls">
      <select id="agent-type-filter">
        <option value="">All Types</option>
        <option value="Explore">Explore</option>
        <option value="general-purpose">General Purpose</option>
      </select>
      <input type="number" id="agent-limit" placeholder="Limit" value="50">
      <button id="load-agents">Load</button>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Invocations</div>
      <div class="stat-value" id="agent-total">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Completed</div>
      <div class="stat-value" id="agent-completed">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">In Progress</div>
      <div class="stat-value" id="agent-in-progress">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Duration</div>
      <div class="stat-value" id="agent-avg-duration">0ms</div>
    </div>
  </div>

  <div id="agent-list"></div>
</div>
```

### 3. Add JavaScript Functions

In `public/js/app.js`:

```javascript
async function loadAgentActivity(projectId, options = {}) {
  const params = new URLSearchParams({
    limit: options.limit || 50,
    ...(options.type && { type: options.type }),
    ...(options.session && { session: options.session }),
    ...(options.feature && { feature: options.feature })
  });

  const response = await fetch(`/api/projects/${projectId}/agent-invocations?${params}`);
  const data = await response.json();

  // Update stats
  document.getElementById('agent-total').textContent = data.stats.total;
  document.getElementById('agent-completed').textContent = data.stats.completed;
  document.getElementById('agent-in-progress').textContent = data.stats.inProgress;
  document.getElementById('agent-avg-duration').textContent = `${data.stats.avgDuration}ms`;

  // Render invocations list
  renderAgentList(data.invocations);
}

function renderAgentList(invocations) {
  const container = document.getElementById('agent-list');
  container.innerHTML = invocations.map(inv => `
    <div class="agent-card ${inv.completed_at ? 'completed' : 'in-progress'}">
      <div class="agent-header">
        <span class="agent-type">${inv.agent_type}</span>
        <span class="agent-time">${new Date(inv.invoked_at).toLocaleString()}</span>
      </div>
      <div class="agent-description">${inv.agent_description || 'No description'}</div>
      <div class="agent-meta">
        ${inv.feature_name ? `<span class="tag">Feature: ${inv.feature_name}</span>` : ''}
        ${inv.section_name ? `<span class="tag">Section: ${inv.section_name}</span>` : ''}
        ${inv.parent_agent ? `<span class="tag">Parent: ${inv.parent_agent}</span>` : ''}
      </div>
      <div class="agent-footer">
        ${inv.completed_at
          ? `<span class="status completed">✓ Completed in ${inv.duration_ms}ms</span>`
          : `<span class="status in-progress">⏳ In Progress</span>`
        }
      </div>
    </div>
  `).join('');
}
```

### 4. Add Styles

In `public/css/style.css`:

```css
.agent-card {
  background: var(--card-bg);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid var(--primary-color);
}

.agent-card.in-progress {
  border-left-color: var(--warning-color);
}

.agent-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.agent-type {
  font-weight: 600;
  color: var(--primary-color);
}

.agent-description {
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-size: 14px;
}

.agent-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.agent-meta .tag {
  background: var(--tag-bg);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.agent-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status.completed {
  color: var(--success-color);
}

.status.in-progress {
  color: var(--warning-color);
}
```

## Benefits

1. **Full Visibility**: See every agent invocation across all tracked projects
2. **Performance Monitoring**: Track agent execution times and identify slow agents
3. **Nesting Analysis**: See when agents call other agents (parent_agent field)
4. **Context Awareness**: Link agent activity to features and sections
5. **Session Tracing**: Follow entire agent call chains by session ID
6. **Automatic Updates**: settings.json (with hooks) updates automatically when updating projects

## Testing

After deploying these changes:

1. **Start cadi-monitor**:
   ```bash
   cd packages/cadi-monitor
   npm start
   ```

2. **Open browser**: http://localhost:3030

3. **Select a project** that has agent logging enabled

4. **Test API endpoint**:
   ```bash
   curl http://localhost:3030/api/projects/YOUR_PROJECT_ID/agent-invocations
   ```

5. **Verify data**: Should see agent invocations if any agents have been used in that project

## Files Modified

- ✅ `packages/cadi-monitor/src/ProjectMonitor.js` - Added agent query methods
- ✅ `packages/cadi-monitor/src/server.js` - Added API endpoint
- ✅ `packages/cadi-monitor/src/UpdateManager.js` - Added settings.json tracking

## Next Steps

- [ ] Add UI tab and visualization (see UI Integration section above)
- [ ] Add agent call hierarchy/tree view
- [ ] Add real-time updates via WebSocket
- [ ] Add export functionality for agent activity reports
- [ ] Add filtering by date range
- [ ] Add performance charts/graphs
