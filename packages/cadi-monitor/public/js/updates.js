/**
 * Updates Management Module
 * Handles checking for updates, previewing changes, applying updates, and managing backups
 */

class UpdatesManager {
  constructor(monitor) {
    this.monitor = monitor;
    this.updateAnalysis = new Map(); // projectId -> analysis
    this.selectedProject = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Check for updates button
    document.getElementById('checkAllUpdatesBtn').addEventListener('click', () => {
      this.checkAllUpdates();
    });

    // Update all button
    document.getElementById('updateAllBtn').addEventListener('click', () => {
      this.updateAllProjects();
    });

    // Modal close buttons
    document.getElementById('closeUpdateModalBtn').addEventListener('click', () => {
      this.hideUpdatePreviewModal();
    });

    document.getElementById('cancelUpdateBtn').addEventListener('click', () => {
      this.hideUpdatePreviewModal();
    });

    document.getElementById('applyUpdateBtn').addEventListener('click', () => {
      this.applyUpdate();
    });

    document.getElementById('closeBackupModalBtn').addEventListener('click', () => {
      this.hideBackupModal();
    });

    // Click outside modal to close
    document.getElementById('updatePreviewModal').addEventListener('click', (e) => {
      if (e.target.id === 'updatePreviewModal') {
        this.hideUpdatePreviewModal();
      }
    });

    document.getElementById('backupModal').addEventListener('click', (e) => {
      if (e.target.id === 'backupModal') {
        this.hideBackupModal();
      }
    });
  }

  /**
   * Check all projects for available updates
   */
  async checkAllUpdates() {
    const btn = document.getElementById('checkAllUpdatesBtn');
    btn.disabled = true;
    btn.textContent = 'Checking...';

    this.showUpdateStatus('Checking for updates...', 'info');

    try {
      const projectIds = this.monitor.projects.map(p => p.id);

      const response = await fetch('/api/updates/batch/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: projectIds })
      });

      if (!response.ok) {
        throw new Error('Failed to check for updates');
      }

      const results = await response.json();

      // Store analysis results
      for (const [projectId, analysis] of Object.entries(results)) {
        this.updateAnalysis.set(projectId, analysis);
      }

      // Render update cards
      this.renderUpdateCards();

      // Count projects with updates
      const projectsWithUpdates = Object.values(results).filter(a =>
        a.changes.added.length > 0 || a.changes.modified.length > 0
      ).length;

      if (projectsWithUpdates > 0) {
        this.showUpdateStatus(
          `${projectsWithUpdates} project(s) have available updates`,
          'success'
        );
        document.getElementById('updateAllBtn').style.display = 'block';
      } else {
        this.showUpdateStatus('All projects are up to date', 'success');
        document.getElementById('updateAllBtn').style.display = 'none';
      }
    } catch (error) {
      console.error('Failed to check updates:', error);
      this.showUpdateStatus(`Error: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right: 0.5rem;">
          <path d="M13.65 2.35C12.2 0.9 10.21 0 8 0 3.58 0 0.01 3.58 0.01 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z" fill="currentColor"/>
        </svg>
        Check for Updates
      `;
    }
  }

  /**
   * Render update cards for all projects
   */
  renderUpdateCards() {
    const container = document.getElementById('updatesGrid');

    if (this.updateAnalysis.size === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-message">No update information</div>
          <div class="empty-state-hint">Click "Check for Updates" to scan for available updates</div>
        </div>
      `;
      return;
    }

    container.innerHTML = Array.from(this.updateAnalysis.entries()).map(([projectId, analysis]) => {
      const project = this.monitor.projects.find(p => p.id === projectId);
      if (!project) return '';

      const hasUpdates = analysis.changes.added.length > 0 || analysis.changes.modified.length > 0;
      const totalChanges = analysis.changes.added.length + analysis.changes.modified.length;

      return `
        <div class="update-card ${hasUpdates ? 'has-updates' : 'up-to-date'}">
          <div class="update-card-header">
            <div>
              <div class="update-card-title">${this.monitor.escapeHtml(project.name)}</div>
              <div class="update-card-status">
                <span class="update-badge ${hasUpdates ? 'available' : 'up-to-date'}">
                  ${hasUpdates ? `${totalChanges} update(s)` : 'Up to date'}
                </span>
              </div>
            </div>
          </div>

          <div class="update-card-changes">
            <div class="update-change-item">
              <span class="update-change-label">New files</span>
              <span class="update-change-value ${analysis.changes.added.length > 0 ? 'has-changes' : ''}">
                ${analysis.changes.added.length}
              </span>
            </div>
            <div class="update-change-item">
              <span class="update-change-label">Modified</span>
              <span class="update-change-value ${analysis.changes.modified.length > 0 ? 'has-changes' : ''}">
                ${analysis.changes.modified.length}
              </span>
            </div>
            <div class="update-change-item">
              <span class="update-change-label">Custom files</span>
              <span class="update-change-value">${analysis.changes.custom.length}</span>
            </div>
          </div>

          <div class="update-card-actions">
            ${hasUpdates ? `
              <button class="btn-primary btn-block" data-action="preview" data-project="${projectId}">
                Preview & Update
              </button>
            ` : `
              <button class="btn-secondary btn-block" disabled>
                No Updates Available
              </button>
            `}
            <button class="btn-secondary" data-action="backups" data-project="${projectId}" title="Manage Backups">
              📁
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Add click listeners
    container.querySelectorAll('[data-action="preview"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const projectId = btn.dataset.project;
        this.showUpdatePreview(projectId);
      });
    });

    container.querySelectorAll('[data-action="backups"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const projectId = btn.dataset.project;
        this.showBackupManager(projectId);
      });
    });
  }

  /**
   * Show update preview modal
   */
  showUpdatePreview(projectId) {
    const analysis = this.updateAnalysis.get(projectId);
    const project = this.monitor.projects.find(p => p.id === projectId);

    if (!analysis || !project) return;

    this.selectedProject = projectId;

    const modal = document.getElementById('updatePreviewModal');
    const title = document.getElementById('updateModalTitle');
    const content = document.getElementById('updatePreviewContent');

    title.textContent = `Update ${project.name}`;

    // Render preview content
    content.innerHTML = `
      <div class="update-preview">
        <div class="update-preview-summary">
          <div class="update-preview-stat">
            <div class="update-preview-stat-value" style="color: var(--success)">${analysis.changes.added.length}</div>
            <div class="update-preview-stat-label">New Files</div>
          </div>
          <div class="update-preview-stat">
            <div class="update-preview-stat-value" style="color: var(--warning)">${analysis.changes.modified.length}</div>
            <div class="update-preview-stat-label">Modified</div>
          </div>
          <div class="update-preview-stat">
            <div class="update-preview-stat-value" style="color: var(--info)">${analysis.changes.custom.length}</div>
            <div class="update-preview-stat-label">Custom (Preserved)</div>
          </div>
        </div>

        ${analysis.changes.added.length > 0 ? `
          <h4 style="margin-bottom: 0.75rem;">New Files</h4>
          <div class="update-file-list">
            ${analysis.changes.added.map(file => `
              <div class="update-file-item">
                <div class="update-file-icon added">+</div>
                <div class="update-file-path">${this.monitor.escapeHtml(file.path)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${analysis.changes.modified.length > 0 ? `
          <h4 style="margin: 1.5rem 0 0.75rem;">Modified Files</h4>
          <div class="update-file-list">
            ${analysis.changes.modified.map(file => `
              <div class="update-file-item">
                <div class="update-file-icon modified">~</div>
                <div class="update-file-path">${this.monitor.escapeHtml(file.path)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${analysis.changes.custom.length > 0 ? `
          <h4 style="margin: 1.5rem 0 0.75rem;">Custom Files (Will Not Be Touched)</h4>
          <div class="update-file-list">
            ${analysis.changes.custom.map(file => `
              <div class="update-file-item">
                <div class="update-file-icon custom">·</div>
                <div class="update-file-path">${this.monitor.escapeHtml(file.path)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${!analysis.safe ? `
          <div class="update-status visible error" style="margin-top: 1.5rem;">
            <strong>⚠️ Safety Issues:</strong>
            <ul style="margin: 0.5rem 0 0 1.5rem;">
              ${analysis.errors.map(err => `<li>${this.monitor.escapeHtml(err)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="update-status visible info" style="margin-top: 1.5rem;">
          <strong>ℹ️ Note:</strong> A backup will be created automatically before applying updates.
          You can rollback anytime if needed.
        </div>
      </div>
    `;

    // Enable/disable apply button based on safety
    document.getElementById('applyUpdateBtn').disabled = !analysis.safe;

    modal.classList.add('active');
  }

  /**
   * Hide update preview modal
   */
  hideUpdatePreviewModal() {
    document.getElementById('updatePreviewModal').classList.remove('active');
    this.selectedProject = null;
  }

  /**
   * Apply update to selected project
   */
  async applyUpdate() {
    if (!this.selectedProject) return;

    const btn = document.getElementById('applyUpdateBtn');
    btn.disabled = true;
    btn.textContent = 'Applying...';

    try {
      const response = await fetch(`/api/updates/${this.selectedProject}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: false,
          skipBackup: false,
          preserveCustom: true
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.errors.join(', '));
      }

      // Show success message
      const content = document.getElementById('updatePreviewContent');
      content.innerHTML = `
        <div class="update-status visible success">
          <h3 style="margin-bottom: 0.5rem;">✓ Update Successful!</h3>
          <p>Added: ${result.applied.added.length} files</p>
          <p>Modified: ${result.applied.modified.length} files</p>
          ${result.backupPath ? `<p style="margin-top: 0.5rem;">Backup created at: <code style="font-size: 0.875rem;">${result.backupPath}</code></p>` : ''}
        </div>
      `;

      // Update button
      btn.textContent = 'Done';

      // Refresh update check after a delay
      setTimeout(() => {
        this.hideUpdatePreviewModal();
        this.checkAllUpdates();
      }, 2000);
    } catch (error) {
      console.error('Failed to apply update:', error);

      const content = document.getElementById('updatePreviewContent');
      content.innerHTML = `
        <div class="update-status visible error">
          <h3 style="margin-bottom: 0.5rem;">✗ Update Failed</h3>
          <p>${this.monitor.escapeHtml(error.message)}</p>
        </div>
      `;

      btn.textContent = 'Close';
      btn.disabled = false;
      btn.onclick = () => this.hideUpdatePreviewModal();
    }
  }

  /**
   * Update all projects that have available updates
   */
  async updateAllProjects() {
    const projectsToUpdate = [];

    for (const [projectId, analysis] of this.updateAnalysis.entries()) {
      const hasUpdates = analysis.changes.added.length > 0 || analysis.changes.modified.length > 0;
      if (hasUpdates && analysis.safe) {
        projectsToUpdate.push(projectId);
      }
    }

    if (projectsToUpdate.length === 0) return;

    const btn = document.getElementById('updateAllBtn');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    this.showUpdateStatus(`Updating ${projectsToUpdate.length} project(s)...`, 'info');

    try {
      const response = await fetch('/api/updates/batch/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projects: projectsToUpdate,
          dryRun: false,
          skipBackup: false,
          preserveCustom: true
        })
      });

      const results = await response.json();

      // Count successes
      const successful = Object.values(results).filter(r => r.success).length;
      const failed = Object.values(results).filter(r => !r.success).length;

      if (failed > 0) {
        this.showUpdateStatus(
          `Updated ${successful} project(s), ${failed} failed`,
          'error'
        );
      } else {
        this.showUpdateStatus(`Successfully updated ${successful} project(s)`, 'success');
      }

      // Refresh
      setTimeout(() => {
        this.checkAllUpdates();
      }, 2000);
    } catch (error) {
      console.error('Failed to update projects:', error);
      this.showUpdateStatus(`Error: ${error.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update All Projects';
    }
  }

  /**
   * Show backup manager modal
   */
  async showBackupManager(projectId) {
    const project = this.monitor.projects.find(p => p.id === projectId);
    if (!project) return;

    const modal = document.getElementById('backupModal');
    const title = document.getElementById('backupModalTitle');
    const content = document.getElementById('backupList');

    title.textContent = `Backups - ${project.name}`;
    content.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading...</div>';

    modal.classList.add('active');

    try {
      const response = await fetch(`/api/updates/${projectId}/backups`);
      const data = await response.json();

      if (data.backups.length === 0) {
        content.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-message">No backups found</div>
            <div class="empty-state-hint">Backups are created automatically before updates</div>
          </div>
        `;
        return;
      }

      content.innerHTML = `
        <div class="backup-list">
          ${data.backups.map(backup => {
            const date = new Date(backup.timestamp).toLocaleString();
            const size = (backup.size / 1024).toFixed(2);

            return `
              <div class="backup-item">
                <div class="backup-info">
                  <div class="backup-name">${this.monitor.escapeHtml(backup.name)}</div>
                  <div class="backup-meta">
                    <span>📅 ${date}</span>
                    <span>📦 ${size} KB</span>
                  </div>
                </div>
                <div class="backup-actions">
                  <button class="btn-primary" data-action="rollback" data-project="${projectId}" data-backup="${this.monitor.escapeHtml(backup.path)}">
                    Rollback
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Add rollback listeners
      content.querySelectorAll('[data-action="rollback"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const projectId = btn.dataset.project;
          const backupPath = btn.dataset.backup;

          if (!confirm('Are you sure you want to rollback to this backup? This will replace your current .claude directory.')) {
            return;
          }

          await this.rollbackToBackup(projectId, backupPath);
        });
      });
    } catch (error) {
      console.error('Failed to load backups:', error);
      content.innerHTML = `
        <div class="update-status visible error">
          <p>Failed to load backups: ${this.monitor.escapeHtml(error.message)}</p>
        </div>
      `;
    }
  }

  /**
   * Hide backup manager modal
   */
  hideBackupModal() {
    document.getElementById('backupModal').classList.remove('active');
  }

  /**
   * Rollback to a specific backup
   */
  async rollbackToBackup(projectId, backupPath) {
    try {
      const response = await fetch(`/api/updates/${projectId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      this.showUpdateStatus('✓ Rollback successful', 'success');
      this.hideBackupModal();
    } catch (error) {
      console.error('Failed to rollback:', error);
      alert(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Show update status message
   */
  showUpdateStatus(message, type = 'info') {
    const status = document.getElementById('updateStatus');
    status.textContent = message;
    status.className = `update-status visible ${type}`;
  }

  /**
   * Handle WebSocket update events
   */
  handleUpdateEvent(data) {
    switch (data.event) {
      case 'updateComplete':
        this.showUpdateStatus(`✓ Update complete for ${data.projectPath}`, 'success');
        break;

      case 'updateFailed':
        this.showUpdateStatus(`✗ Update failed for ${data.projectPath}: ${data.error}`, 'error');
        break;

      case 'backupCreated':
        console.log('Backup created:', data.projectPath);
        break;
    }
  }
}
