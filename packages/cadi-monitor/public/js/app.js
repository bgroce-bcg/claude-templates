// CADI Monitor Client Application
class CADIMonitor {
  constructor() {
    this.ws = null;
    this.projects = [];
    this.selectedProject = null;
    this.currentView = 'overview';
    this.activityLog = [];

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupWebSocket();
    this.setupEventListeners();
    this.loadProjects();
  }

  /**
   * Setup WebSocket connection
   */
  setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.addEventListener('open', () => {
      console.log('WebSocket connected');
      this.updateConnectionStatus(true);
    });

    this.ws.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      this.updateConnectionStatus(false);

      // Attempt to reconnect after 5 seconds
      setTimeout(() => this.setupWebSocket(), 5000);
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });

    this.ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.updateConnectionStatus(false);
    });
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('Server acknowledged connection');
        break;

      case 'fileChange':
        this.addActivityItem(`File ${data.eventType}: ${data.file}`, data.projectName, data.timestamp);
        break;

      case 'statsChanged':
        console.log('Stats changed for', data.projectName);
        this.addActivityItem('Project statistics updated', data.projectName, data.timestamp);
        this.loadProjects(); // Refresh project data
        break;

      case 'projectInitialized':
        console.log('Project initialized:', data.name);
        this.addActivityItem('Project initialized', data.name, new Date().toISOString());
        this.loadProjects();
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(connected) {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');

    if (connected) {
      statusIndicator.classList.add('connected');
      statusIndicator.classList.remove('disconnected');
      statusText.textContent = 'Connected';
    } else {
      statusIndicator.classList.remove('connected');
      statusIndicator.classList.add('disconnected');
      statusText.textContent = 'Disconnected';
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadProjects();
      if (this.selectedProject) {
        this.loadProjectDetails(this.selectedProject);
      }
    });

    // Add project button
    document.getElementById('addProjectBtn').addEventListener('click', () => {
      this.showAddProjectModal();
    });

    // Modal close buttons
    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.hideAddProjectModal();
    });

    document.getElementById('cancelAddBtn').addEventListener('click', () => {
      this.hideAddProjectModal();
    });

    // Add project form
    document.getElementById('addProjectForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddProject();
    });

    // View tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });

    // Click outside modal to close
    document.getElementById('addProjectModal').addEventListener('click', (e) => {
      if (e.target.id === 'addProjectModal') {
        this.hideAddProjectModal();
      }
    });

    // Error filters
    document.getElementById('severityFilter').addEventListener('change', () => {
      if (this.selectedProject && this.currentView === 'errors') {
        this.loadErrors(this.selectedProject);
      }
    });

    document.getElementById('resolvedFilter').addEventListener('change', () => {
      if (this.selectedProject && this.currentView === 'errors') {
        this.loadErrors(this.selectedProject);
      }
    });
  }

  /**
   * Load all projects from API
   */
  async loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();

      this.projects = data.projects;
      this.renderProjectsList();
      this.renderOverview();
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  /**
   * Render projects list in sidebar
   */
  renderProjectsList() {
    const container = document.getElementById('projectsList');

    if (this.projects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-message">No projects</div>
          <div class="empty-state-hint">Click "Add Project" to get started</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.projects.map(project => {
      const stats = project.stats || { features: { byStatus: {} }, sections: { byStatus: {} } };
      const inProgress = (stats.features.byStatus.in_progress || 0) + (stats.sections.byStatus.in_progress || 0);
      const completed = (stats.features.byStatus.completed || 0);

      return `
        <div class="project-item ${this.selectedProject === project.id ? 'active' : ''}"
             data-project-id="${project.id}">
          <div class="project-item-header">
            <div class="project-color" style="background-color: ${project.color}"></div>
            <div class="project-name">${this.escapeHtml(project.name)}</div>
          </div>
          <div class="project-stats">
            <div class="project-stat">
              <span>⚡</span>
              <span>${inProgress}</span>
            </div>
            <div class="project-stat">
              <span>✓</span>
              <span>${completed}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click listeners
    container.querySelectorAll('.project-item').forEach(item => {
      item.addEventListener('click', () => {
        const projectId = item.dataset.projectId;
        this.selectProject(projectId);
      });
    });
  }

  /**
   * Select a project
   */
  selectProject(projectId) {
    this.selectedProject = projectId;
    this.renderProjectsList();
    this.loadProjectDetails(projectId);

    // Switch to features view if in overview
    if (this.currentView === 'overview') {
      this.switchView('features');
    }
  }

  /**
   * Load project details
   */
  async loadProjectDetails(projectId) {
    const project = this.projects.find(p => p.id === projectId);

    if (!project) return;

    // Update view subtitles
    document.getElementById('featuresProjectName').textContent = project.name;
    document.getElementById('contextProjectName').textContent = project.name;
    document.getElementById('errorsProjectName').textContent = project.name;

    // Load features
    if (this.currentView === 'features') {
      await this.loadFeatures(projectId);
    }

    // Load context
    if (this.currentView === 'context') {
      await this.loadContext(projectId);
    }

    // Load errors
    if (this.currentView === 'errors') {
      await this.loadErrors(projectId);
    }
  }

  /**
   * Load features for a project
   */
  async loadFeatures(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/features`);
      const data = await response.json();

      this.renderFeatures(data.features, projectId);
    } catch (error) {
      console.error('Failed to load features:', error);
    }
  }

  /**
   * Render features
   */
  renderFeatures(features, projectId) {
    const container = document.getElementById('featuresContainer');

    if (!features || features.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-message">No features found</div>
          <div class="empty-state-hint">Features will appear here when they are created</div>
        </div>
      `;
      return;
    }

    container.innerHTML = features.map(feature => `
      <div class="feature-card" data-feature-id="${feature.id}">
        <div class="feature-header" data-feature-id="${feature.id}">
          <div class="feature-info">
            <div class="feature-name">${this.escapeHtml(feature.name)}</div>
            ${feature.summary ? `<div class="feature-summary">${this.escapeHtml(feature.summary)}</div>` : ''}
          </div>
          <div class="feature-meta">
            <span class="badge badge-${feature.status}">${feature.status}</span>
          </div>
        </div>
        <div class="sections-list" id="sections-${feature.id}"></div>
      </div>
    `).join('');

    // Add click listeners for expanding sections
    container.querySelectorAll('.feature-header').forEach(header => {
      header.addEventListener('click', async () => {
        const featureId = header.dataset.featureId;
        const sectionsList = document.getElementById(`sections-${featureId}`);

        if (sectionsList.classList.contains('expanded')) {
          sectionsList.classList.remove('expanded');
        } else {
          await this.loadSections(projectId, featureId);
          sectionsList.classList.add('expanded');
        }
      });
    });
  }

  /**
   * Load sections for a feature
   */
  async loadSections(projectId, featureId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/features/${featureId}/sections`);
      const data = await response.json();

      this.renderSections(data.sections, featureId);
    } catch (error) {
      console.error('Failed to load sections:', error);
    }
  }

  /**
   * Render sections
   */
  renderSections(sections, featureId) {
    const container = document.getElementById(`sections-${featureId}`);

    if (!sections || sections.length === 0) {
      container.innerHTML = '<div class="empty-state-hint">No sections defined</div>';
      return;
    }

    container.innerHTML = sections.map(section => `
      <div class="section-item">
        <div class="section-name">
          ${this.escapeHtml(section.name)}
          <span class="badge badge-${section.status}" style="margin-left: 0.5rem">${section.status}</span>
        </div>
        ${section.description ? `<div class="section-description">${this.escapeHtml(section.description)}</div>` : ''}
        <div class="section-meta">
          ${section.estimated_hours ? `<span>Est: ${section.estimated_hours}h</span>` : ''}
          ${section.actual_hours ? `<span>Actual: ${section.actual_hours}h</span>` : ''}
          ${section.started_at ? `<span>Started: ${new Date(section.started_at).toLocaleDateString()}</span>` : ''}
          ${section.completed_at ? `<span>Completed: ${new Date(section.completed_at).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  /**
   * Load context documents
   */
  async loadContext(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/context`);
      const data = await response.json();

      this.renderContext(data.documents);
    } catch (error) {
      console.error('Failed to load context:', error);
    }
  }

  /**
   * Render context documents
   */
  renderContext(documents) {
    const container = document.getElementById('contextContainer');

    if (!documents || documents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-message">No context documents</div>
          <div class="empty-state-hint">Index documentation using /index-docs command</div>
        </div>
      `;
      return;
    }

    container.innerHTML = documents.map(doc => `
      <div class="context-doc">
        <div class="context-doc-category" style="background-color: ${this.getCategoryColor(doc.category)}">${doc.category}</div>
        <div class="context-doc-title">${this.escapeHtml(doc.title)}</div>
        <div class="context-doc-path">${this.escapeHtml(doc.file_path)}</div>
        ${doc.summary ? `<div class="context-doc-summary">${this.escapeHtml(doc.summary)}</div>` : ''}
        <div class="context-doc-meta">
          <span>${doc.estimated_tokens || 0} tokens</span>
          <span>${new Date(doc.last_indexed).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  }

  /**
   * Get color for document category
   */
  getCategoryColor(category) {
    const colors = {
      backend: 'rgba(46, 160, 67, 0.2)',
      frontend: 'rgba(9, 105, 218, 0.2)',
      feature: 'rgba(245, 158, 11, 0.2)',
      plan: 'rgba(139, 92, 246, 0.2)'
    };

    return colors[category] || 'rgba(125, 133, 144, 0.2)';
  }

  /**
   * Load errors for a project
   */
  async loadErrors(projectId) {
    try {
      const severityFilter = document.getElementById('severityFilter').value;
      const resolvedFilter = document.getElementById('resolvedFilter').value;

      let url = `/api/projects/${projectId}/errors?`;
      if (severityFilter) url += `severity=${severityFilter}&`;
      if (resolvedFilter) url += `resolved=${resolvedFilter}&`;

      const response = await fetch(url);
      const data = await response.json();

      this.renderErrors(data.errors, data.stats);
    } catch (error) {
      console.error('Failed to load errors:', error);
    }
  }

  /**
   * Render errors
   */
  renderErrors(errors, stats) {
    // Render error stats
    const statsContainer = document.getElementById('errorStats');
    statsContainer.innerHTML = `
      <div class="error-stat-card">
        <div class="error-stat-value">${stats.total}</div>
        <div class="error-stat-label">Total Errors</div>
      </div>
      <div class="error-stat-card">
        <div class="error-stat-value">${stats.unresolved}</div>
        <div class="error-stat-label">Unresolved</div>
      </div>
      <div class="error-stat-card">
        <div class="error-stat-value">${stats.resolved}</div>
        <div class="error-stat-label">Resolved</div>
      </div>
      <div class="error-stat-card">
        <div class="error-stat-value">${stats.bySeverity.critical || 0}</div>
        <div class="error-stat-label">Critical</div>
      </div>
      <div class="error-stat-card">
        <div class="error-stat-value">${stats.bySeverity.high || 0}</div>
        <div class="error-stat-label">High</div>
      </div>
    `;

    // Render error list
    const container = document.getElementById('errorsContainer');

    if (!errors || errors.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-message">No errors logged</div>
          <div class="empty-state-hint">Agents will log errors here as they encounter issues</div>
        </div>
      `;
      return;
    }

    container.innerHTML = errors.map(error => {
      const timestamp = new Date(error.timestamp);
      const timeStr = timestamp.toLocaleString();

      return `
        <div class="error-item severity-${error.severity} ${error.resolved ? 'resolved' : ''}">
          <div class="error-header">
            <div class="error-title">
              <div class="error-type">${this.escapeHtml(error.error_type)}</div>
              <div class="error-agent">
                ${this.escapeHtml(error.agent_name)}
                ${error.command_name ? ` → ${this.escapeHtml(error.command_name)}` : ''}
              </div>
            </div>
            <div class="error-meta">
              <span class="error-severity ${error.severity}">${error.severity}</span>
              ${error.resolved ? '<span class="badge badge-completed">Resolved</span>' : ''}
            </div>
          </div>

          <div class="error-message">${this.escapeHtml(error.error_message)}</div>

          ${error.error_context ? `
            <div class="error-context">${this.escapeHtml(error.error_context)}</div>
          ` : ''}

          ${error.resolution ? `
            <div class="error-resolution">
              <div class="error-resolution-label">Resolution</div>
              ${this.escapeHtml(error.resolution)}
            </div>
          ` : ''}

          <div class="error-footer">
            <span>${timeStr}</span>
            ${error.feature_name ? `
              <a href="#" class="error-feature-link" onclick="return false;">
                ${this.escapeHtml(error.feature_name)}
                ${error.section_name ? ` / ${this.escapeHtml(error.section_name)}` : ''}
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render overview
   */
  async renderOverview() {
    try {
      const response = await fetch('/api/stats');
      const stats = await response.json();

      // Render stats cards
      const statsContainer = document.getElementById('overviewStats');
      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Total Projects</div>
          <div class="stat-value">${stats.totalProjects}</div>
          <div class="stat-breakdown">
            <span>Active: ${stats.activeProjects}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Features</div>
          <div class="stat-value">${stats.totalFeatures}</div>
          <div class="stat-breakdown">
            <span>In Progress: ${stats.featuresByStatus.in_progress || 0}</span>
            <span>Completed: ${stats.featuresByStatus.completed || 0}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Sections</div>
          <div class="stat-value">${stats.totalSections}</div>
          <div class="stat-breakdown">
            <span>In Progress: ${stats.sectionsByStatus.in_progress || 0}</span>
            <span>Completed: ${stats.sectionsByStatus.completed || 0}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Context Documents</div>
          <div class="stat-value">${stats.totalContextDocs}</div>
        </div>
      `;

      // Render project cards
      const projectsContainer = document.getElementById('projectsGrid');
      projectsContainer.innerHTML = this.projects.map(project => {
        const stats = project.stats || { features: { total: 0, byStatus: {} }, sections: { total: 0, byStatus: {} } };

        return `
          <div class="project-card" data-project-id="${project.id}">
            <div class="project-card-header">
              <div class="project-card-color" style="background-color: ${project.color}"></div>
              <div class="project-card-name">${this.escapeHtml(project.name)}</div>
            </div>
            <div class="project-card-path">${this.escapeHtml(project.path)}</div>
            <div class="project-card-stats">
              <div class="project-card-stat">
                <span class="project-card-stat-label">Features</span>
                <span class="project-card-stat-value">${stats.features.total}</span>
              </div>
              <div class="project-card-stat">
                <span class="project-card-stat-label">In Progress</span>
                <span class="project-card-stat-value">${(stats.features.byStatus.in_progress || 0) + (stats.sections.byStatus.in_progress || 0)}</span>
              </div>
              <div class="project-card-stat">
                <span class="project-card-stat-label">Completed</span>
                <span class="project-card-stat-value">${stats.features.byStatus.completed || 0}</span>
              </div>
              <div class="project-card-stat">
                <span class="project-card-stat-label">Context Docs</span>
                <span class="project-card-stat-value">${stats.contextDocs || 0}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Add click listeners
      projectsContainer.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => {
          const projectId = card.dataset.projectId;
          this.selectProject(projectId);
        });
      });
    } catch (error) {
      console.error('Failed to load overview stats:', error);
    }
  }

  /**
   * Switch view
   */
  switchView(viewName) {
    this.currentView = viewName;

    // Update tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.dataset.view === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`${viewName}View`);
    if (activeView) {
      activeView.classList.add('active');
    }

    // Load data for view
    if (viewName === 'overview') {
      this.renderOverview();
    } else if (viewName === 'features' && this.selectedProject) {
      this.loadFeatures(this.selectedProject);
    } else if (viewName === 'context' && this.selectedProject) {
      this.loadContext(this.selectedProject);
    } else if (viewName === 'errors' && this.selectedProject) {
      this.loadErrors(this.selectedProject);
    } else if (viewName === 'activity') {
      this.renderActivityFeed();
    }
  }

  /**
   * Show add project modal
   */
  showAddProjectModal() {
    document.getElementById('addProjectModal').classList.add('active');
  }

  /**
   * Hide add project modal
   */
  hideAddProjectModal() {
    document.getElementById('addProjectModal').classList.remove('active');
    document.getElementById('addProjectForm').reset();
  }

  /**
   * Handle add project form submission
   */
  async handleAddProject() {
    const form = document.getElementById('addProjectForm');
    const formData = new FormData(form);

    const project = {
      id: formData.get('id'),
      name: formData.get('name'),
      path: formData.get('path'),
      color: formData.get('color'),
      enabled: true
    };

    try {
      const response = await fetch('/api/config/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to add project: ${error.error}`);
        return;
      }

      this.hideAddProjectModal();
      this.loadProjects();
    } catch (error) {
      console.error('Failed to add project:', error);
      alert('Failed to add project. Check console for details.');
    }
  }

  /**
   * Add activity item
   */
  addActivityItem(message, projectName, timestamp) {
    this.activityLog.unshift({
      message,
      projectName,
      timestamp
    });

    // Keep only last 100 items
    if (this.activityLog.length > 100) {
      this.activityLog = this.activityLog.slice(0, 100);
    }

    // Update activity feed if visible
    if (this.currentView === 'activity') {
      this.renderActivityFeed();
    }
  }

  /**
   * Render activity feed
   */
  renderActivityFeed() {
    const container = document.getElementById('activityFeed');

    if (this.activityLog.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-message">No activity yet</div>
          <div class="empty-state-hint">Activity will appear here as you work</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.activityLog.map(item => {
      const time = new Date(item.timestamp);
      const timeStr = time.toLocaleTimeString();

      return `
        <div class="activity-item">
          <div class="activity-icon" style="background-color: rgba(59, 130, 246, 0.1)">
            <span>📝</span>
          </div>
          <div class="activity-content">
            <div class="activity-message">
              <strong>${this.escapeHtml(item.projectName)}</strong>: ${this.escapeHtml(item.message)}
            </div>
            <div class="activity-time">${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.cadiMonitor = new CADIMonitor();
});
