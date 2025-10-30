// CADI Monitor Client Application
class CADIMonitor {
  constructor() {
    this.ws = null;
    this.projects = [];
    this.selectedProject = null;
    this.currentView = 'overview';
    this.activityLog = [];
    this.pendingFeatures = new Map(); // Map<projectId:featureName, tempFeatureData>
    this.featureOutputs = new Map(); // Map<projectId:featureName, outputText>
    this.currentlyViewingFeature = null; // { projectId, featureName }

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupWebSocket();
    this.setupEventListeners();
    this.loadProjects();

    // Initialize UpdatesManager (if available)
    if (typeof UpdatesManager !== 'undefined') {
      this.updatesManager = new UpdatesManager(this);
    }

    // Initialize AgentActivityManager (if available)
    if (typeof AgentActivityManager !== 'undefined') {
      this.agentActivityManager = new AgentActivityManager(this);
    }
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
    console.log('[WebSocket] Received message:', data.type, data);

    switch (data.type) {
      case 'connected':
        console.log('Server acknowledged connection');
        break;

      case 'fileChange':
        this.addActivityItem(`File ${data.eventType}: ${data.file}`, data.projectName, data.timestamp);
        break;

      case 'statsChanged':
        console.log('Stats changed for', data.projectName);
        // Skip adding "Project statistics updated" to activity log (too frequent)
        // Only update project list and overview, don't reload entire projects
        this.updateProjectStats(data.projectId);

        // Only refresh current view if it's overview (most views don't need refresh on stats change)
        if (this.currentView === 'overview') {
          this.renderOverview();
        }
        break;

      case 'projectInitialized':
        console.log('Project initialized:', data.name);
        this.addActivityItem('Project initialized', data.name, new Date().toISOString());
        this.loadProjects();
        break;

      case 'updateEvent':
        // Forward to UpdatesManager
        if (this.updatesManager) {
          this.updatesManager.handleUpdateEvent(data);
        }
        break;

      case 'featureCreated':
        console.log(`Feature created: ${data.featureName}`);
        this.handleFeatureCreated(data);
        break;

      case 'featureCreationProgress':
        console.log(`Feature creation progress: ${data.featureName}`);
        this.handleFeatureCreationProgress(data);
        break;

      case 'featureCreationError':
        console.error(`Feature creation error: ${data.featureName}`, data.error);
        this.handleFeatureCreationError(data);
        break;

      case 'featureCreationComplete':
        console.log(`Feature creation complete: ${data.featureName}, exit code: ${data.exitCode}`);
        this.handleFeatureCreationComplete(data);
        break;

      case 'featureProcessStarted':
        console.log(`Feature process started: ${data.featureName}`);
        this.handleFeatureProcessStarted(data);
        break;

      case 'featureProcessStopped':
        console.log(`Feature process stopped: ${data.featureName}`);
        this.handleFeatureProcessStopped(data);
        break;

      case 'featureStatusChanged':
        console.log(`Feature status changed: ${data.featureName} (${data.oldStatus} → ${data.newStatus})`);
        this.handleFeatureStatusChanged(data);
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

    // Delete project modal
    document.getElementById('closeDeleteModalBtn').addEventListener('click', () => {
      this.hideDeleteProjectModal();
    });

    document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
      this.hideDeleteProjectModal();
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
      this.handleDeleteProject();
    });

    // Create feature button
    document.getElementById('createFeatureBtn').addEventListener('click', () => {
      this.showCreateFeatureModal();
    });

    // Create feature modal
    document.getElementById('closeCreateFeatureModalBtn').addEventListener('click', () => {
      this.hideCreateFeatureModal();
    });

    document.getElementById('cancelCreateFeatureBtn').addEventListener('click', () => {
      this.hideCreateFeatureModal();
    });

    // Create feature form
    document.getElementById('createFeatureForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateFeature();
    });

    // Click outside modal to close
    document.getElementById('createFeatureModal').addEventListener('click', (e) => {
      if (e.target.id === 'createFeatureModal') {
        this.hideCreateFeatureModal();
      }
    });

    // Feature details modal
    document.getElementById('closeFeatureDetailsModalBtn').addEventListener('click', () => {
      this.hideFeatureDetailsModal();
    });

    document.getElementById('featureDetailsModal').addEventListener('click', (e) => {
      if (e.target.id === 'featureDetailsModal') {
        this.hideFeatureDetailsModal();
      }
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

    document.getElementById('deleteProjectModal').addEventListener('click', (e) => {
      if (e.target.id === 'deleteProjectModal') {
        this.hideDeleteProjectModal();
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

    // Sub-tabs (for Context and Database views)
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subview = e.target.dataset.subview;
        // Determine which view we're in based on the parent
        const parentView = e.target.closest('.view');
        if (parentView && parentView.id === 'contextView') {
          this.switchContextSubview(subview);
        } else if (parentView && parentView.id === 'databaseView') {
          this.switchDatabaseSubview(subview);
        }
      });
    });

    // Context loads filters
    document.getElementById('agentFilter').addEventListener('change', (e) => {
      if (typeof contextLoadsManager !== 'undefined') {
        contextLoadsManager.setFilter('agent', e.target.value);
      }
    });

    document.getElementById('limitFilter').addEventListener('change', (e) => {
      if (typeof contextLoadsManager !== 'undefined') {
        contextLoadsManager.setFilter('limit', parseInt(e.target.value) || 50);
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
   * Update stats for a specific project without disrupting the UI
   */
  async updateProjectStats(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();

      // Update the project in our local array
      const projectIndex = this.projects.findIndex(p => p.id === projectId);
      if (projectIndex !== -1) {
        this.projects[projectIndex] = data;
        // Re-render just the project list, not the entire view
        this.renderProjectsList();
      }
    } catch (error) {
      console.error('Failed to update project stats:', error);
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
            <button class="btn-icon btn-delete" data-project-id="${project.id}" title="Remove project" style="margin-left: auto; padding: 0.25rem;">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M11 1.5v-1h-6v1h-3.5v1h13v-1h-3.5zm-7.5 14h9l1-12h-11l1 12z" fill="currentColor"/>
              </svg>
            </button>
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
      item.addEventListener('click', (e) => {
        // Don't select project if clicking delete button
        if (e.target.closest('.btn-delete')) {
          return;
        }
        const projectId = item.dataset.projectId;
        this.selectProject(projectId);
      });
    });

    // Add delete button listeners
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent project selection
        const projectId = btn.dataset.projectId;
        this.showDeleteProjectModal(projectId);
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

    const agentsProjectName = document.getElementById('agentsProjectName');
    if (agentsProjectName) {
      agentsProjectName.textContent = project.name;
    }

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
   * Render features as Kanban board
   */
  renderFeatures(features, projectId) {
    const container = document.getElementById('featuresContainer');

    // Merge pending features with database features
    const featureNames = new Set(features.map(f => f.name));
    const pendingForProject = [];

    // Add pending features that don't exist in DB yet
    for (const [key, pendingFeature] of this.pendingFeatures.entries()) {
      if (key.startsWith(`${projectId}:`)) {
        const featureName = key.split(':')[1];
        if (!featureNames.has(featureName)) {
          pendingForProject.push(pendingFeature);
        } else {
          // Feature now exists in DB, remove from pending
          this.pendingFeatures.delete(key);
        }
      }
    }

    const allFeatures = [...pendingForProject, ...features];

    if (allFeatures.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-message">No features found</div>
          <div class="empty-state-hint">Create a feature to get started</div>
        </div>
      `;
      return;
    }

    // Group features by status
    const columns = {
      planning: { title: 'Planning', features: [] },
      in_progress: { title: 'In Progress', features: [] },
      testing: { title: 'Testing', features: [] },
      completed: { title: 'Complete', features: [] }
    };

    allFeatures.forEach(feature => {
      const status = feature.status === 'ready' ? 'planning' : feature.status;
      if (columns[status]) {
        columns[status].features.push(feature);
      }
    });

    // Build Kanban board HTML
    container.innerHTML = `
      <div class="kanban-board">
        ${Object.entries(columns).map(([status, column]) => `
          <div class="kanban-column" data-status="${status}">
            <div class="kanban-column-header">
              <h3>${column.title}</h3>
              <span class="kanban-column-count">${column.features.length}</span>
            </div>
            <div class="kanban-column-content">
              ${column.features.length === 0 ? `
                <div class="kanban-empty-state">No features</div>
              ` : column.features.map(feature => `
                <div class="kanban-card ${feature.hasActiveProcess ? 'has-active-process' : ''} ${feature.isPending ? 'pending-feature' : ''}" data-feature-id="${feature.id || ''}" data-feature-name="${this.escapeHtml(feature.name)}" data-status="${status}">
                  <div class="kanban-card-header">
                    <div class="kanban-card-title">
                      ${feature.hasActiveProcess ? '<span class="active-process-indicator" title="Claude is working on this feature"></span>' : ''}
                      ${this.escapeHtml(feature.name)}
                    </div>
                    ${status !== 'completed' && !feature.isPending ? `
                      <button class="kanban-card-next-btn" data-feature-id="${feature.id}" data-current-status="${status}" title="Move to next stage">→</button>
                    ` : ''}
                  </div>
                  ${feature.summary ? `<div class="kanban-card-summary">${this.escapeHtml(feature.summary)}</div>` : ''}
                  <div class="kanban-card-footer">
                    <span class="kanban-card-date">${new Date(feature.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Add click listeners for next-stage buttons
    container.querySelectorAll('.kanban-card-next-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const featureId = btn.dataset.featureId;
        const currentStatus = btn.dataset.currentStatus;
        await this.moveFeatureToNextStage(projectId, featureId, currentStatus);
      });
    });

    // Add click listeners for cards to expand sections
    container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', async () => {
        const featureId = card.dataset.featureId;
        // Skip pending features (they don't have IDs yet)
        if (!featureId) return;
        await this.showFeatureDetails(projectId, featureId);
      });
    });
  }

  /**
   * Move feature to next stage in workflow
   */
  async moveFeatureToNextStage(projectId, featureId, currentStatus) {
    const statusFlow = {
      'planning': 'in_progress',
      'in_progress': 'testing',
      'testing': 'completed'
    };

    const nextStatus = statusFlow[currentStatus];
    if (!nextStatus) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/features/${featureId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to update status: ${error.error}`);
        return;
      }

      // Refresh features view
      await this.loadFeatures(projectId);
    } catch (error) {
      console.error('Failed to update feature status:', error);
      alert('Failed to update feature status. Check console for details.');
    }
  }

  /**
   * Show feature details modal/overlay
   */
  async showFeatureDetails(projectId, featureId) {
    try {
      // Load feature details
      const featureResponse = await fetch(`/api/projects/${projectId}/features`);
      const featureData = await featureResponse.json();
      const feature = featureData.features.find(f => f.id === parseInt(featureId));

      if (!feature) {
        alert('Feature not found');
        return;
      }

      // Load sections
      const sectionsResponse = await fetch(`/api/projects/${projectId}/features/${featureId}/sections`);
      const sectionsData = await sectionsResponse.json();

      // Set currently viewing feature
      this.currentlyViewingFeature = {
        projectId: projectId,
        featureName: feature.name
      };

      // Update modal content
      document.getElementById('featureDetailsTitle').textContent = feature.name;

      // Check if there's live output for this feature
      const outputKey = `${projectId}:${feature.name}`;
      const liveOutputSection = document.getElementById('featureLiveOutputSection');
      const liveOutput = document.getElementById('featureLiveOutput');

      if (this.featureOutputs.has(outputKey)) {
        // Show live output section with stored output
        liveOutputSection.style.display = 'block';
        liveOutput.textContent = this.featureOutputs.get(outputKey);
        liveOutput.scrollTop = liveOutput.scrollHeight;
      } else {
        // Hide live output section
        liveOutputSection.style.display = 'none';
        liveOutput.textContent = '';
      }

      const summaryEl = document.getElementById('featureDetailsSummary');
      summaryEl.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span class="badge badge-${feature.status}">${feature.status}</span>
            <span style="color: var(--text-secondary); font-size: 0.875rem;">
              Created ${new Date(feature.created_at).toLocaleDateString()}
            </span>
          </div>
          ${feature.summary ? `<p style="color: var(--text-secondary); margin: 0;">${this.escapeHtml(feature.summary)}</p>` : ''}
        </div>
      `;

      const sectionsEl = document.getElementById('featureDetailsSections');
      if (!sectionsData.sections || sectionsData.sections.length === 0) {
        sectionsEl.innerHTML = `
          <div class="empty-state" style="padding: 2rem; text-align: center;">
            <div class="empty-state-message">No sections defined yet</div>
            <div class="empty-state-hint">Sections will appear here once the planning is complete</div>
          </div>
        `;
      } else {
        sectionsEl.innerHTML = sectionsData.sections.map(section => `
          <div class="section-card" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <div style="font-weight: 600; font-size: 1rem;">${this.escapeHtml(section.name)}</div>
              <span class="badge badge-${section.status}">${section.status}</span>
            </div>
            ${section.description ? `
              <div style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 0.75rem;">
                ${this.escapeHtml(section.description)}
              </div>
            ` : ''}
            <div style="display: flex; gap: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
              ${section.estimated_hours ? `<span>Est: ${section.estimated_hours}h</span>` : ''}
              ${section.actual_hours ? `<span>Actual: ${section.actual_hours}h</span>` : ''}
              ${section.started_at ? `<span>Started: ${new Date(section.started_at).toLocaleDateString()}</span>` : ''}
              ${section.completed_at ? `<span>Completed: ${new Date(section.completed_at).toLocaleDateString()}</span>` : ''}
            </div>
          </div>
        `).join('');
      }

      // Show modal
      document.getElementById('featureDetailsModal').classList.add('active');
    } catch (error) {
      console.error('Failed to load feature details:', error);
      alert('Failed to load feature details. Check console for details.');
    }
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

      // Also load context loads if that subview is active
      const loadsSubview = document.getElementById('contextLoads');
      if (loadsSubview && loadsSubview.classList.contains('active') && typeof contextLoadsManager !== 'undefined') {
        await contextLoadsManager.init(projectId);
      }
    } catch (error) {
      console.error('Failed to load context:', error);
    }
  }

  /**
   * Switch context subview
   */
  switchContextSubview(subview) {
    // Update sub-tabs within context view
    const contextView = document.getElementById('contextView');
    contextView.querySelectorAll('.sub-tab-btn').forEach(btn => {
      if (btn.dataset.subview === subview) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update sub-views within context view
    contextView.querySelectorAll('.sub-view').forEach(view => {
      view.classList.remove('active');
    });

    if (subview === 'documents') {
      document.getElementById('contextDocuments').classList.add('active');
    } else if (subview === 'loads') {
      document.getElementById('contextLoads').classList.add('active');
      // Load context loads when switching to this view
      if (this.selectedProject && typeof contextLoadsManager !== 'undefined') {
        contextLoadsManager.init(this.selectedProject);
      }
    }
  }

  /**
   * Switch database sub-view
   */
  switchDatabaseSubview(subview) {
    // Update sub-tabs within database view
    const databaseView = document.getElementById('databaseView');
    databaseView.querySelectorAll('.sub-tab-btn').forEach(btn => {
      if (btn.dataset.subview === subview) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update sub-views within database view
    databaseView.querySelectorAll('.sub-view').forEach(view => {
      view.classList.remove('active');
    });

    if (subview === 'tables') {
      document.getElementById('databaseTables').classList.add('active');
    } else if (subview === 'query') {
      document.getElementById('databaseQuery').classList.add('active');
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
   * Refresh the currently active view
   */
  refreshCurrentView() {
    if (!this.selectedProject) return;

    switch (this.currentView) {
      case 'features':
        this.loadFeatures(this.selectedProject);
        break;
      case 'context':
        this.loadContext(this.selectedProject);
        break;
      case 'errors':
        this.loadErrors(this.selectedProject);
        break;
      case 'agents':
        if (this.agentActivityManager) {
          this.agentActivityManager.loadAgents(this.selectedProject);
        }
        break;
      case 'database':
        if (typeof loadDatabaseTables !== 'undefined') {
          loadDatabaseTables(this.selectedProject);
        }
        break;
      case 'overview':
        this.renderOverview();
        break;
      case 'activity':
        this.renderActivityFeed();
        break;
      case 'system':
        this.loadSystemConfig();
        break;
      // 'updates' view doesn't auto-refresh - user must click "Check for Updates"
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
    } else if (viewName === 'updates') {
      // Updates view doesn't load automatically - user clicks "Check for Updates"
    } else if (viewName === 'activity') {
      this.renderActivityFeed();
    } else if (viewName === 'errors' && this.selectedProject) {
      this.loadErrors(this.selectedProject);
    } else if (viewName === 'agents' && this.selectedProject && this.agentActivityManager) {
      this.agentActivityManager.loadAgents(this.selectedProject);
    } else if (viewName === 'database' && this.selectedProject) {
      // Update database view project name
      document.getElementById('databaseProjectName').textContent = this.getProjectName(this.selectedProject);
      // Load database tables
      if (typeof loadDatabaseTables !== 'undefined') {
        loadDatabaseTables(this.selectedProject);
      }
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
   * Show delete project modal
   */
  showDeleteProjectModal(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    // Store project ID for deletion
    this.projectToDelete = projectId;

    // Update modal content
    document.getElementById('deleteProjectName').textContent = project.name;
    document.getElementById('deleteProjectPath').textContent = project.path;

    // Show modal
    document.getElementById('deleteProjectModal').classList.add('active');
  }

  /**
   * Hide delete project modal
   */
  hideDeleteProjectModal() {
    document.getElementById('deleteProjectModal').classList.remove('active');
    this.projectToDelete = null;
  }

  /**
   * Handle project deletion
   */
  async handleDeleteProject() {
    if (!this.projectToDelete) return;

    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.textContent = 'Removing...';

    try {
      const response = await fetch(`/api/config/projects/${this.projectToDelete}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to remove project: ${error.error}`);
        return;
      }

      // If the deleted project was selected, clear selection
      if (this.selectedProject === this.projectToDelete) {
        this.selectedProject = null;
      }

      this.hideDeleteProjectModal();
      this.loadProjects();
    } catch (error) {
      console.error('Failed to remove project:', error);
      alert('Failed to remove project. Check console for details.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Remove Project';
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
   * Handle feature created (before DB record exists)
   */
  handleFeatureCreated(data) {
    const key = `${data.projectId}:${data.featureName}`;

    // Store pending feature
    this.pendingFeatures.set(key, {
      name: data.featureName,
      status: 'planning',
      summary: data.description,
      created_at: data.createdAt,
      isPending: true,
      hasActiveProcess: true
    });

    // Refresh features view if we're currently viewing this project
    if (this.selectedProject === data.projectId && this.currentView === 'features') {
      this.loadFeatures(data.projectId);
    }
  }

  /**
   * Handle feature creation progress
   */
  handleFeatureCreationProgress(data) {
    // Store output for this feature
    const key = `${data.projectId}:${data.featureName}`;
    const currentOutput = this.featureOutputs.get(key) || '';
    this.featureOutputs.set(key, currentOutput + data.output);

    console.log(`[FeatureProgress] Received output for ${key}`);
    console.log(`[FeatureProgress] Currently viewing:`, this.currentlyViewingFeature);
    console.log(`[FeatureProgress] Stored outputs keys:`, Array.from(this.featureOutputs.keys()));

    // Show live output in activity log
    this.addActivityItem(`Creating feature: ${data.output.substring(0, 100)}`,
                         this.getProjectName(data.projectId),
                         new Date().toISOString());

    // If there's a feature creation modal open, append to output
    const outputElement = document.getElementById('featureCreationOutput');
    if (outputElement) {
      outputElement.textContent += data.output;
      outputElement.scrollTop = outputElement.scrollHeight;
    }

    // If feature details modal is open for this feature, update live output
    if (this.currentlyViewingFeature &&
        this.currentlyViewingFeature.projectId === data.projectId &&
        this.currentlyViewingFeature.featureName === data.featureName) {
      console.log(`[FeatureProgress] Updating live output for ${key}`);
      const liveOutputSection = document.getElementById('featureLiveOutputSection');
      const liveOutput = document.getElementById('featureLiveOutput');
      if (liveOutputSection && liveOutput) {
        liveOutputSection.style.display = 'block';
        liveOutput.textContent = this.featureOutputs.get(key);
        liveOutput.scrollTop = liveOutput.scrollHeight;
      }
    }
  }

  /**
   * Handle feature creation error
   */
  handleFeatureCreationError(data) {
    this.addActivityItem(`Feature creation error: ${data.featureName}`,
                         this.getProjectName(data.projectId),
                         new Date().toISOString());

    const outputElement = document.getElementById('featureCreationOutput');
    if (outputElement) {
      const errorDiv = document.createElement('div');
      errorDiv.style.color = '#ef4444';
      errorDiv.textContent = `ERROR: ${data.error}`;
      outputElement.appendChild(errorDiv);
      outputElement.scrollTop = outputElement.scrollHeight;
    }
  }

  /**
   * Handle feature creation complete
   */
  handleFeatureCreationComplete(data) {
    const success = data.exitCode === 0;
    const message = success
      ? `Feature '${data.featureName}' created successfully`
      : `Feature '${data.featureName}' creation failed (exit code: ${data.exitCode})`;

    this.addActivityItem(message, this.getProjectName(data.projectId), new Date().toISOString());

    // Close modal if open
    const modal = document.getElementById('createFeatureModal');
    if (modal && success) {
      setTimeout(() => {
        this.hideCreateFeatureModal();
        // Refresh features view
        if (this.selectedProject === data.projectId) {
          this.loadFeatures(data.projectId);
        }
      }, 2000);
    }
  }

  /**
   * Get project name by ID
   */
  getProjectName(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : projectId;
  }

  /**
   * Show create feature modal
   */
  showCreateFeatureModal() {
    if (!this.selectedProject) {
      alert('Please select a project first');
      return;
    }
    document.getElementById('createFeatureModal').classList.add('active');
  }

  /**
   * Hide create feature modal
   */
  hideCreateFeatureModal() {
    document.getElementById('createFeatureModal').classList.remove('active');
    document.getElementById('createFeatureForm').reset();
    const outputElement = document.getElementById('featureCreationOutput');
    if (outputElement) {
      outputElement.textContent = '';
    }
  }

  /**
   * Hide feature details modal
   */
  hideFeatureDetailsModal() {
    document.getElementById('featureDetailsModal').classList.remove('active');
  }

  /**
   * Handle create feature form submission
   */
  async handleCreateFeature() {
    const form = document.getElementById('createFeatureForm');
    const formData = new FormData(form);
    const name = formData.get('featureName');
    const description = formData.get('featureDescription');

    const submitBtn = document.getElementById('createFeatureSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
      const response = await fetch(`/api/projects/${this.selectedProject}/features/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`Failed to create feature: ${result.error}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Feature';
        return;
      }

      // Close modal immediately
      this.hideCreateFeatureModal();

      // Refresh features view to show new card
      await this.loadFeatures(this.selectedProject);

      // Show activity notification
      this.addActivityItem(`Started planning feature: ${name}`,
                           this.getProjectName(this.selectedProject),
                           new Date().toISOString());
    } catch (error) {
      console.error('Failed to create feature:', error);
      alert('Failed to create feature. Check console for details.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Feature';
    }
  }

  /**
   * Handle feature process started
   */
  handleFeatureProcessStarted(data) {
    // Refresh features to show active indicator
    if (this.selectedProject === data.projectId && this.currentView === 'features') {
      this.loadFeatures(data.projectId);
    }
  }

  /**
   * Handle feature process stopped
   */
  handleFeatureProcessStopped(data) {
    // Refresh features to remove active indicator and show updated status
    if (this.selectedProject === data.projectId && this.currentView === 'features') {
      this.loadFeatures(data.projectId);
    }
  }

  /**
   * Handle feature status changed
   */
  handleFeatureStatusChanged(data) {
    // Refresh features to show updated status in correct column
    if (this.selectedProject === data.projectId && this.currentView === 'features') {
      this.loadFeatures(data.projectId);
    }

    // Add activity log
    this.addActivityItem(`Feature ${data.featureName} moved to ${data.newStatus}`,
                         this.getProjectName(data.projectId),
                         new Date().toISOString());
  }

  /**
   * Load and render system configuration from manifest
   */
  async loadSystemConfig() {
    const container = document.getElementById('systemContainer');

    try {
      const response = await fetch('/api/manifest');
      if (!response.ok) {
        throw new Error('Failed to load manifest data');
      }

      const manifest = await response.json();
      this.renderSystemConfig(manifest);
    } catch (error) {
      console.error('Failed to load system config:', error);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-message">Failed to load system configuration</div>
          <div class="empty-state-hint">${this.escapeHtml(error.message)}</div>
        </div>
      `;
    }
  }

  /**
   * Render system configuration UI
   */
  renderSystemConfig(manifest) {
    const container = document.getElementById('systemContainer');

    container.innerHTML = `
      <div class="system-config">
        <!-- Summary Stats -->
        <div class="stats-grid" style="margin-bottom: 2rem;">
          <div class="stat-card">
            <div class="stat-label">Schema Version</div>
            <div class="stat-value">${manifest.schemaVersion}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Database Tables</div>
            <div class="stat-value">${manifest.summary.tableCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Migrations</div>
            <div class="stat-value">${manifest.summary.migrationCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Directories</div>
            <div class="stat-value">${manifest.summary.directoryCount}</div>
          </div>
        </div>

        <!-- File Structure -->
        <div class="system-section">
          <h3>File Structure</h3>
          <div class="system-cards">
            <div class="system-card">
              <h4>Base Claude Files</h4>
              <p><strong>Source:</strong> ${this.escapeHtml(manifest.fileStructure.baseClaude.source)}</p>
              <p><strong>Destination:</strong> ${this.escapeHtml(manifest.fileStructure.baseClaude.destination)}</p>
              <p><strong>Includes:</strong></p>
              <ul>
                ${manifest.fileStructure.baseClaude.include.map(pattern =>
                  `<li><code>${this.escapeHtml(pattern)}</code></li>`
                ).join('')}
              </ul>
            </div>
            <div class="system-card">
              <h4>Scripts</h4>
              <p><strong>Source:</strong> ${this.escapeHtml(manifest.fileStructure.scripts.source)}</p>
              <p><strong>Destination:</strong> ${this.escapeHtml(manifest.fileStructure.scripts.destination)}</p>
              <p><strong>Includes:</strong></p>
              <ul>
                ${manifest.fileStructure.scripts.include.map(pattern =>
                  `<li><code>${this.escapeHtml(pattern)}</code></li>`
                ).join('')}
              </ul>
            </div>
          </div>
        </div>

        <!-- Categorization Rules -->
        <div class="system-section">
          <h3>File Categorization</h3>
          <div class="system-cards">
            <div class="system-card">
              <h4>Tracked Extensions</h4>
              <div class="badge-list">
                ${manifest.categorization.trackedExtensions.map(ext =>
                  `<span class="badge badge-info">${this.escapeHtml(ext)}</span>`
                ).join('')}
              </div>
            </div>
            <div class="system-card">
              <h4>CADI-Managed Paths</h4>
              <p class="help-text">These paths are always updated from the template</p>
              <ul>
                ${manifest.categorization.cadiManagedPaths.map(path =>
                  `<li><code>${this.escapeHtml(path)}</code></li>`
                ).join('')}
              </ul>
            </div>
            <div class="system-card">
              <h4>Custom File Paths</h4>
              <p class="help-text">These paths are preserved during updates</p>
              <ul>
                ${manifest.categorization.customFilePaths.map(path =>
                  `<li><code>${this.escapeHtml(path)}</code></li>`
                ).join('')}
              </ul>
            </div>
          </div>
        </div>

        <!-- Directory Structure -->
        <div class="system-section">
          <h3>Directory Structure</h3>
          <p class="help-text">Directories automatically created during project initialization</p>
          <div class="system-card">
            <ul>
              ${manifest.directories.map(dir =>
                `<li><code>${this.escapeHtml(dir)}</code></li>`
              ).join('')}
            </ul>
          </div>
        </div>

        <!-- Database Schema -->
        <div class="system-section">
          <h3>Database Schema</h3>
          <div class="system-cards">
            ${Object.entries(manifest.schema.tables).map(([tableName, table]) => `
              <div class="system-card">
                <h4>${this.escapeHtml(tableName)}</h4>
                <p><strong>Columns:</strong></p>
                <ul style="font-size: 0.875rem; font-family: monospace;">
                  ${table.columns.map(col =>
                    `<li>${this.escapeHtml(col)}</li>`
                  ).join('')}
                </ul>
                ${table.indexes && table.indexes.length > 0 ? `
                  <p><strong>Indexes:</strong></p>
                  <ul style="font-size: 0.875rem; font-family: monospace;">
                    ${table.indexes.map(idx =>
                      `<li>${this.escapeHtml(idx)}</li>`
                    ).join('')}
                  </ul>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.cadiMonitor = new CADIMonitor();
});
