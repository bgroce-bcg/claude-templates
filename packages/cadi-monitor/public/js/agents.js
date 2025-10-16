// Agent Activity Manager
class AgentActivityManager {
  constructor(cadiMonitor) {
    this.cadiMonitor = cadiMonitor;
    this.currentProjectId = null;
    this.agentTypes = new Set();

    this.init();
  }

  init() {
    // Setup load button
    const loadBtn = document.getElementById('loadAgentsBtn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        if (this.currentProjectId) {
          this.loadAgents(this.currentProjectId);
        }
      });
    }

    // Setup agent type filter
    const typeFilter = document.getElementById('agentTypeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => {
        if (this.currentProjectId) {
          this.loadAgents(this.currentProjectId);
        }
      });
    }
  }

  async loadAgents(projectId) {
    this.currentProjectId = projectId;

    try {
      const typeFilter = document.getElementById('agentTypeFilter').value;
      const limit = parseInt(document.getElementById('agentLimitFilter').value) || 50;

      let url = `/api/projects/${projectId}/agent-invocations?limit=${limit}`;
      if (typeFilter) {
        url += `&type=${encodeURIComponent(typeFilter)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      // Update agent type filter options
      this.updateAgentTypeFilter(data.invocations);

      // Render stats and invocations
      this.renderStats(data.stats);
      this.renderInvocations(data.invocations);
    } catch (error) {
      console.error('Failed to load agent invocations:', error);
      const container = document.getElementById('agentsContainer');
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-message">Failed to load agent data</div>
          <div class="empty-state-hint">${error.message}</div>
        </div>
      `;
    }
  }

  updateAgentTypeFilter(invocations) {
    const typeFilter = document.getElementById('agentTypeFilter');
    const currentValue = typeFilter.value;

    // Collect unique agent types
    invocations.forEach(inv => {
      this.agentTypes.add(inv.agent_type);
    });

    // Update filter options
    const options = ['<option value="">All Types</option>'];
    Array.from(this.agentTypes).sort().forEach(type => {
      options.push(`<option value="${type}">${this.escapeHtml(type)}</option>`);
    });

    typeFilter.innerHTML = options.join('');
    typeFilter.value = currentValue; // Restore selection
  }

  renderStats(stats) {
    if (!stats) {
      document.getElementById('agentStats').innerHTML = '';
      return;
    }

    const container = document.getElementById('agentStats');

    container.innerHTML = `
      <div class="agent-stat-card">
        <div class="agent-stat-value">${stats.total}</div>
        <div class="agent-stat-label">Total Invocations</div>
      </div>
      <div class="agent-stat-card">
        <div class="agent-stat-value">${stats.completed}</div>
        <div class="agent-stat-label">Completed</div>
      </div>
      <div class="agent-stat-card">
        <div class="agent-stat-value">${stats.inProgress}</div>
        <div class="agent-stat-label">In Progress</div>
      </div>
      <div class="agent-stat-card">
        <div class="agent-stat-value">${stats.avgDuration}ms</div>
        <div class="agent-stat-label">Avg Duration</div>
      </div>
    `;
  }

  renderInvocations(invocations) {
    const container = document.getElementById('agentsContainer');

    if (!invocations || invocations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🤖</div>
          <div class="empty-state-message">No agent invocations found</div>
          <div class="empty-state-hint">Agent activity will appear here when agents are used</div>
        </div>
      `;
      return;
    }

    container.innerHTML = invocations.map(inv => {
      const invokedTime = new Date(inv.invoked_at);
      const timeStr = invokedTime.toLocaleString();
      const isCompleted = inv.completed_at != null;
      const statusClass = isCompleted ? 'completed' : 'in-progress';

      return `
        <div class="agent-card ${statusClass}">
          <div class="agent-header">
            <div class="agent-type-badge">${this.escapeHtml(inv.agent_type)}</div>
            <div class="agent-time">${timeStr}</div>
          </div>

          ${inv.agent_description ? `
            <div class="agent-description">${this.escapeHtml(inv.agent_description)}</div>
          ` : ''}

          <div class="agent-meta">
            ${inv.feature_name ? `
              <span class="agent-tag">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                  <path d="M1 2.5A2.5 2.5 0 0 1 3.5 0h8.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V1.5h-8a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.5a.75.75 0 0 1 1.5 0v3.5a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 1 13.5v-11Z"/>
                </svg>
                ${this.escapeHtml(inv.feature_name)}
              </span>
            ` : ''}
            ${inv.section_name ? `
              <span class="agent-tag">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                  <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75Z"/>
                </svg>
                ${this.escapeHtml(inv.section_name)}
              </span>
            ` : ''}
            ${inv.parent_agent ? `
              <span class="agent-tag parent-agent">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                  <path d="M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6h-1A1.5 1.5 0 0 1 6 4.5v-1zM7.5 7A1.5 1.5 0 0 1 9 8.5v1A1.5 1.5 0 0 1 7.5 11h-1A1.5 1.5 0 0 1 5 9.5v-1A1.5 1.5 0 0 1 6.5 7h1z"/>
                </svg>
                Parent: ${this.escapeHtml(inv.parent_agent)}
              </span>
            ` : ''}
          </div>

          <div class="agent-footer">
            ${isCompleted ? `
              <span class="agent-status completed">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                </svg>
                Completed in ${inv.duration_ms}ms
              </span>
            ` : `
              <span class="agent-status in-progress">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px; animation: spin 2s linear infinite;">
                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" opacity=".3"/>
                  <path d="M8 0a8 8 0 0 1 8 8h-2A6 6 0 0 0 8 2V0Z"/>
                </svg>
                In Progress
              </span>
            `}

            ${inv.session_id ? `
              <span class="agent-session" title="Session ID: ${inv.session_id}">
                Session: ${inv.session_id.substring(0, 8)}...
              </span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance will be created when needed
let agentActivityManager = null;
