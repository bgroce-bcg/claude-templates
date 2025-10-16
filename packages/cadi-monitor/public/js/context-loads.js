/**
 * Context Loads UI functionality
 */

class ContextLoadsManager {
  constructor() {
    this.currentProjectId = null;
    this.filters = {
      agent: null,
      limit: 50
    };
  }

  /**
   * Initialize context loads view for a project
   */
  async init(projectId) {
    this.currentProjectId = projectId;
    await this.loadContextLoads();
  }

  /**
   * Load context loads from API
   */
  async loadContextLoads() {
    if (!this.currentProjectId) return;

    try {
      const params = new URLSearchParams();
      if (this.filters.agent) params.append('agent', this.filters.agent);
      if (this.filters.limit) params.append('limit', this.filters.limit);

      const response = await fetch(`/api/projects/${this.currentProjectId}/context-loads?${params}`);
      const data = await response.json();

      this.renderStats(data.stats);
      this.renderLoads(data.loads);
      this.populateAgentFilter(data.loads);
    } catch (error) {
      console.error('Failed to load context loads:', error);
      this.renderError('Failed to load context loads');
    }
  }

  /**
   * Render statistics
   */
  renderStats(stats) {
    const container = document.getElementById('contextLoadsStats');
    if (!container) return;

    if (!stats || stats.total === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No context loads recorded yet</p>
          <small>Context loads will appear here once agents start loading context</small>
        </div>
      `;
      return;
    }

    const byAgentHtml = Object.entries(stats.byAgent || {})
      .map(([agent, count]) => `<div class="stat-item"><span class="stat-label">${agent}:</span> <span class="stat-value">${count}</span></div>`)
      .join('');

    const byCategoryHtml = Object.entries(stats.byCategory || {})
      .map(([category, count]) => `<div class="stat-item"><span class="stat-label">${category}:</span> <span class="stat-value">${count}</span></div>`)
      .join('');

    container.innerHTML = `
      <div class="stats-grid-small">
        <div class="stat-card">
          <div class="stat-label">Total Loads</div>
          <div class="stat-value-large">${stats.total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Documents</div>
          <div class="stat-value-large">${stats.totalDocuments.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Tokens</div>
          <div class="stat-value-large">${stats.totalTokens.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Duration</div>
          <div class="stat-value-large">${stats.avgDuration}ms</div>
        </div>
      </div>
      <div class="stats-breakdown">
        <div class="breakdown-section">
          <h4>By Agent</h4>
          ${byAgentHtml || '<div class="stat-item">No data</div>'}
        </div>
        <div class="breakdown-section">
          <h4>By Category</h4>
          ${byCategoryHtml || '<div class="stat-item">No data</div>'}
        </div>
      </div>
    `;
  }

  /**
   * Render context loads list
   */
  renderLoads(loads) {
    const container = document.getElementById('contextLoadsContainer');
    if (!container) return;

    if (!loads || loads.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No context loads found</p>
          <small>Try adjusting your filters or check back after agents run</small>
        </div>
      `;
      return;
    }

    const loadsHtml = loads.map(load => this.renderLoadCard(load)).join('');
    container.innerHTML = `<div class="context-loads-list">${loadsHtml}</div>`;
  }

  /**
   * Render a single context load card
   */
  renderLoadCard(load) {
    const timestamp = new Date(load.timestamp).toLocaleString();
    const documentIds = load.document_ids ? JSON.parse(load.document_ids) : [];

    let durationClass = 'duration-normal';
    if (load.duration_ms > 1000) durationClass = 'duration-slow';
    else if (load.duration_ms > 2000) durationClass = 'duration-very-slow';

    let tokenClass = 'tokens-normal';
    if (load.total_tokens > 10000) tokenClass = 'tokens-high';
    else if (load.total_tokens > 20000) tokenClass = 'tokens-very-high';

    return `
      <div class="context-load-card">
        <div class="load-header">
          <div class="load-meta">
            <span class="load-timestamp">${timestamp}</span>
            <span class="load-id">#${load.id}</span>
          </div>
          <span class="load-agent">${this.escapeHtml(load.agent_name)}</span>
        </div>

        <div class="load-body">
          <div class="load-request">
            <strong>Request:</strong> ${this.escapeHtml(load.request)}
          </div>

          ${load.category ? `<div class="load-category"><span class="badge">${load.category}</span></div>` : ''}

          ${load.feature_name ? `
            <div class="load-context">
              <strong>Feature:</strong> ${this.escapeHtml(load.feature_name)}
              ${load.section_name ? ` / <strong>Section:</strong> ${this.escapeHtml(load.section_name)}` : ''}
            </div>
          ` : ''}

          ${load.tags ? `<div class="load-tags"><strong>Tags:</strong> ${this.escapeHtml(load.tags)}</div>` : ''}
        </div>

        <div class="load-footer">
          <div class="load-stats">
            <div class="load-stat">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM2 13V3h12v10H2z" fill="currentColor"/>
                <path d="M4 5h8v2H4V5zm0 3h8v2H4V8z" fill="currentColor"/>
              </svg>
              <span>${load.document_count} docs</span>
            </div>

            <div class="load-stat ${tokenClass}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 0L0 4v5c0 4.5 3.5 7.8 8 9 4.5-1.2 8-4.5 8-9V4L8 0zm0 2.1L14 5v4c0 3.5-2.6 6.1-6 7.1-3.4-1-6-3.6-6-7.1V5l6-2.9z" fill="currentColor"/>
              </svg>
              <span>${load.total_tokens ? load.total_tokens.toLocaleString() : '0'} tokens</span>
            </div>

            <div class="load-stat ${durationClass}">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm0 14.5A6.5 6.5 0 1 1 8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/>
                <path d="M8 3v5.4l3.5 2.1-.8 1.3L6.5 9V3H8z" fill="currentColor"/>
              </svg>
              <span>${load.duration_ms || 0}ms</span>
            </div>
          </div>

          ${documentIds.length > 0 ? `
            <button class="btn-link btn-sm" onclick="contextLoadsManager.showDocuments(${load.id}, ${JSON.stringify(documentIds).replace(/"/g, '&quot;')})">
              View Documents
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Populate agent filter dropdown
   */
  populateAgentFilter(loads) {
    const select = document.getElementById('agentFilter');
    if (!select) return;

    const agents = [...new Set(loads.map(l => l.agent_name))].sort();
    const currentValue = select.value;

    select.innerHTML = '<option value="">All Agents</option>' +
      agents.map(agent => `<option value="${this.escapeHtml(agent)}">${this.escapeHtml(agent)}</option>`).join('');

    select.value = currentValue;
  }

  /**
   * Show documents for a context load (future enhancement)
   */
  showDocuments(loadId, documentIds) {
    alert(`Context Load #${loadId}\n\nDocuments loaded: ${documentIds.join(', ')}\n\n(Document details view coming soon)`);
  }

  /**
   * Set filter and reload
   */
  setFilter(filterName, value) {
    this.filters[filterName] = value;
    this.loadContextLoads();
  }

  /**
   * Render error message
   */
  renderError(message) {
    const container = document.getElementById('contextLoadsContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="error-state">
        <p>❌ ${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance
const contextLoadsManager = new ContextLoadsManager();
