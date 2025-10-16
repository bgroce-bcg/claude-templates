const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const ProjectMonitor = require('./ProjectMonitor');
const ConfigManager = require('./ConfigManager');
const UpdateManager = require('./UpdateManager');

/**
 * CADI Monitor Server
 * Manages multiple ProjectMonitors and provides REST + WebSocket API
 */
class MonitorServer {
  constructor(configPath = null, templatePath = null) {
    this.configManager = new ConfigManager(configPath);
    this.updateManager = templatePath ? new UpdateManager(templatePath) : null;
    this.projects = new Map(); // Map<projectId, ProjectMonitor>
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();

    // Setup update manager event listeners
    if (this.updateManager) {
      this.setupUpdateManagerEvents();
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));

    // CORS for local development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Logging
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup REST API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get all projects with their stats
    this.app.get('/api/projects', (req, res) => {
      const projects = [];

      for (const [id, monitor] of this.projects) {
        projects.push({
          id: monitor.id,
          name: monitor.name,
          path: monitor.path,
          color: monitor.color,
          enabled: monitor.enabled,
          stats: monitor.getStats(),
          health: monitor.getHealth()
        });
      }

      res.json({ projects });
    });

    // Get single project details
    this.app.get('/api/projects/:id', (req, res) => {
      const monitor = this.projects.get(req.params.id);

      if (!monitor) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({
        id: monitor.id,
        name: monitor.name,
        path: monitor.path,
        color: monitor.color,
        enabled: monitor.enabled,
        stats: monitor.getStats(),
        health: monitor.getHealth()
      });
    });

    // Get features for a project
    this.app.get('/api/projects/:id/features', (req, res) => {
      const monitor = this.projects.get(req.params.id);

      if (!monitor) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const features = monitor.getFeatures();
      res.json({ features });
    });

    // Get sections for a feature
    this.app.get('/api/projects/:id/features/:featureId/sections', (req, res) => {
      const monitor = this.projects.get(req.params.id);

      if (!monitor) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const sections = monitor.getSections(parseInt(req.params.featureId));
      res.json({ sections });
    });

    // Get context documents for a project
    this.app.get('/api/projects/:id/context', (req, res) => {
      const monitor = this.projects.get(req.params.id);

      if (!monitor) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const documents = monitor.getContextDocuments();
      res.json({ documents });
    });

    // Get errors for a project
    this.app.get('/api/projects/:id/errors', (req, res) => {
      const monitor = this.projects.get(req.params.id);

      if (!monitor) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const options = {
        limit: parseInt(req.query.limit) || 50,
        severity: req.query.severity || null,
        resolved: req.query.resolved !== undefined ? req.query.resolved === 'true' : null,
        agentName: req.query.agent || null,
        featureId: req.query.feature ? parseInt(req.query.feature) : null
      };

      const errors = monitor.getErrors(options);
      const stats = monitor.getErrorStats();

      res.json({ errors, stats });
    });

    // Get context loads for a project
    this.app.get('/api/projects/:id/context-loads', (req, res) => {
      const monitor = this.projects.get(req.params.id);

      if (!monitor) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const options = {
        limit: parseInt(req.query.limit) || 50,
        agentName: req.query.agent || null,
        featureId: req.query.feature ? parseInt(req.query.feature) : null,
        sectionId: req.query.section ? parseInt(req.query.section) : null
      };

      const loads = monitor.getContextLoads(options);
      const stats = monitor.getContextLoadStats();

      res.json({ loads, stats });
    });

    // Get agent invocations for a project
    this.app.get('/api/projects/:id/agent-invocations', (req, res) => {
      const monitor = this.projects.get(req.params.id);

      if (!monitor) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const options = {
        limit: parseInt(req.query.limit) || 50,
        agentType: req.query.type || null,
        sessionId: req.query.session || null,
        featureId: req.query.feature ? parseInt(req.query.feature) : null,
        parentAgent: req.query.parent || null
      };

      const invocations = monitor.getAgentInvocations(options);
      const stats = monitor.getAgentStats();

      res.json({ invocations, stats });
    });

    // Get aggregated stats across all projects
    this.app.get('/api/stats', (req, res) => {
      const stats = {
        totalProjects: this.projects.size,
        activeProjects: 0,
        totalFeatures: 0,
        featuresByStatus: {},
        totalSections: 0,
        sectionsByStatus: {},
        totalContextDocs: 0
      };

      for (const monitor of this.projects.values()) {
        const projectStats = monitor.getStats();

        if (projectStats) {
          stats.totalFeatures += projectStats.features.total;
          stats.totalSections += projectStats.sections.total;
          stats.totalContextDocs += projectStats.contextDocs || 0;

          // Aggregate by status
          for (const [status, count] of Object.entries(projectStats.features.byStatus)) {
            stats.featuresByStatus[status] = (stats.featuresByStatus[status] || 0) + count;
          }

          for (const [status, count] of Object.entries(projectStats.sections.byStatus)) {
            stats.sectionsByStatus[status] = (stats.sectionsByStatus[status] || 0) + count;
          }

          // Count active projects (has in_progress features or sections)
          if (projectStats.features.byStatus.in_progress > 0 || projectStats.sections.byStatus.in_progress > 0) {
            stats.activeProjects++;
          }
        }
      }

      res.json(stats);
    });

    // Configuration endpoints
    this.app.get('/api/config', (req, res) => {
      const config = this.configManager.get();
      res.json(config);
    });

    this.app.post('/api/config/projects', async (req, res) => {
      try {
        const { id, name, path, color, enabled } = req.body;

        if (!id || !name || !path) {
          return res.status(400).json({ error: 'Missing required fields: id, name, path' });
        }

        this.configManager.addProject({ id, name, path, color, enabled });

        // Initialize the new project monitor
        await this.loadProject({ id, name, path, color, enabled });

        res.json({ success: true, project: this.configManager.getProject(id) });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    this.app.delete('/api/config/projects/:id', (req, res) => {
      try {
        const projectId = req.params.id;

        // Stop and remove the monitor
        const monitor = this.projects.get(projectId);
        if (monitor) {
          monitor.close();
          this.projects.delete(projectId);
        }

        // Remove from config
        this.configManager.removeProject(projectId);

        res.json({ success: true });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Update endpoints
    if (this.updateManager) {
      // Analyze what would change
      this.app.get('/api/updates/:id/analyze', async (req, res) => {
        try {
          const monitor = this.projects.get(req.params.id);
          if (!monitor) {
            return res.status(404).json({ error: 'Project not found' });
          }

          const analysis = await this.updateManager.analyzeUpdates(monitor.path);
          res.json(analysis);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Apply updates
      this.app.post('/api/updates/:id/apply', async (req, res) => {
        try {
          const monitor = this.projects.get(req.params.id);
          if (!monitor) {
            return res.status(404).json({ error: 'Project not found' });
          }

          const options = {
            dryRun: req.body.dryRun || false,
            skipBackup: req.body.skipBackup || false,
            preserveCustom: req.body.preserveCustom !== false
          };

          const result = await this.updateManager.applyUpdates(monitor.path, options);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // List backups
      this.app.get('/api/updates/:id/backups', (req, res) => {
        try {
          const monitor = this.projects.get(req.params.id);
          if (!monitor) {
            return res.status(404).json({ error: 'Project not found' });
          }

          const backups = this.updateManager.listBackups(monitor.path);
          res.json({ backups });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Rollback to backup
      this.app.post('/api/updates/:id/rollback', async (req, res) => {
        try {
          const monitor = this.projects.get(req.params.id);
          if (!monitor) {
            return res.status(404).json({ error: 'Project not found' });
          }

          const backupPath = req.body.backupPath || null;
          const result = await this.updateManager.rollback(monitor.path, backupPath);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Batch analyze multiple projects
      this.app.post('/api/updates/batch/analyze', async (req, res) => {
        try {
          const projectIds = req.body.projects || [];
          const results = {};

          for (const projectId of projectIds) {
            const monitor = this.projects.get(projectId);
            if (monitor) {
              results[projectId] = await this.updateManager.analyzeUpdates(monitor.path);
            }
          }

          res.json(results);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Batch apply updates to multiple projects
      this.app.post('/api/updates/batch/apply', async (req, res) => {
        try {
          const projectIds = req.body.projects || [];
          const options = {
            dryRun: req.body.dryRun || false,
            skipBackup: req.body.skipBackup || false,
            preserveCustom: req.body.preserveCustom !== false
          };

          const results = {};

          for (const projectId of projectIds) {
            const monitor = this.projects.get(projectId);
            if (monitor) {
              results[projectId] = await this.updateManager.applyUpdates(monitor.path, options);
            }
          }

          res.json(results);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });
    }

    // Serve the main UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  /**
   * Setup update manager event listeners
   */
  setupUpdateManagerEvents() {
    this.updateManager.on('backupCreated', (data) => {
      console.log(`✓ Backup created for ${data.projectPath}`);
      this.broadcast({
        type: 'updateEvent',
        event: 'backupCreated',
        ...data
      });
    });

    this.updateManager.on('fileAdded', (data) => {
      this.broadcast({
        type: 'updateEvent',
        event: 'fileAdded',
        ...data
      });
    });

    this.updateManager.on('fileModified', (data) => {
      this.broadcast({
        type: 'updateEvent',
        event: 'fileModified',
        ...data
      });
    });

    this.updateManager.on('updateComplete', (data) => {
      console.log(`✓ Update complete for ${data.projectPath}`);
      this.broadcast({
        type: 'updateEvent',
        event: 'updateComplete',
        ...data
      });
    });

    this.updateManager.on('updateFailed', (data) => {
      console.error(`✗ Update failed for ${data.projectPath}: ${data.error}`);
      this.broadcast({
        type: 'updateEvent',
        event: 'updateFailed',
        ...data
      });
    });

    this.updateManager.on('rollbackComplete', (data) => {
      console.log(`✓ Rollback complete for ${data.projectPath}`);
      this.broadcast({
        type: 'updateEvent',
        event: 'rollbackComplete',
        ...data
      });
    });
  }

  /**
   * Setup WebSocket connections
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      // Send initial data
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString()
      }));

      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error.message);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  /**
   * Handle WebSocket messages from clients
   */
  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        // Client wants to subscribe to specific project events
        // Store subscription info on ws object
        ws.subscribedProjects = data.projects || [];
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  /**
   * Broadcast event to all connected WebSocket clients
   */
  broadcast(event) {
    const message = JSON.stringify(event);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // Check if client is subscribed to this project
        if (!client.subscribedProjects ||
            client.subscribedProjects.length === 0 ||
            client.subscribedProjects.includes(event.projectId)) {
          client.send(message);
        }
      }
    });
  }

  /**
   * Load a project monitor
   */
  async loadProject(projectConfig) {
    const monitor = new ProjectMonitor(projectConfig);

    // Setup event listeners
    monitor.on('initialized', (data) => {
      console.log(`✓ Initialized monitor for ${data.name}`);
      this.broadcast({ type: 'projectInitialized', ...data });
    });

    monitor.on('fileChange', (data) => {
      console.log(`File changed in ${data.projectName}: ${data.file}`);
      this.broadcast({ type: 'fileChange', ...data });
    });

    monitor.on('statsChanged', (data) => {
      console.log(`Stats changed for ${data.projectName}`);
      this.broadcast({ type: 'statsChanged', ...data });
    });

    monitor.on('closed', (data) => {
      console.log(`Closed monitor for ${data.projectId}`);
      this.broadcast({ type: 'projectClosed', ...data });
    });

    try {
      await monitor.init();
      this.projects.set(projectConfig.id, monitor);
    } catch (error) {
      console.error(`Failed to load project ${projectConfig.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Load all enabled projects from config
   */
  async loadProjects() {
    const config = this.configManager.get();
    const enabledProjects = config.projects.filter(p => p.enabled !== false);

    console.log(`Loading ${enabledProjects.length} project(s)...`);

    const results = await Promise.allSettled(
      enabledProjects.map(project => this.loadProject(project))
    );

    // Report results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Successfully loaded ${successful} project(s)`);
    if (failed > 0) {
      console.log(`Failed to load ${failed} project(s)`);
    }
  }

  /**
   * Start the server
   */
  async start() {
    // Initialize config
    this.configManager.init();

    // Load projects
    await this.loadProjects();

    // Start HTTP server
    const config = this.configManager.get();
    const port = config.port || 3030;
    const host = config.host || 'localhost';

    this.server.listen(port, host, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════');
      console.log('  CADI Monitor');
      console.log('═══════════════════════════════════════════════════');
      console.log(`  Server running at http://${host}:${port}`);
      console.log(`  Monitoring ${this.projects.size} project(s)`);
      console.log('═══════════════════════════════════════════════════');
      console.log('');
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    console.log('Shutting down...');

    // Close all project monitors
    for (const monitor of this.projects.values()) {
      await monitor.close();
    }

    // Close WebSocket connections
    this.wss.clients.forEach((client) => {
      client.close();
    });

    // Close server
    this.server.close(() => {
      console.log('Server stopped');
    });
  }
}

// Run server if executed directly
if (require.main === module) {
  // Default template path is base-claude in repo root (two levels up from packages/cadi-monitor/src)
  const defaultTemplatePath = path.join(__dirname, '../../../base-claude');
  const server = new MonitorServer(null, defaultTemplatePath);

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

module.exports = MonitorServer;
