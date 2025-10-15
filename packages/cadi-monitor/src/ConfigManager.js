const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Manages configuration for CADI Monitor
 * Stores config in ~/.cadi-monitor/config.json
 */
class ConfigManager {
  constructor(configPath = null) {
    this.configDir = configPath || path.join(os.homedir(), '.cadi-monitor');
    this.configFile = path.join(this.configDir, 'config.json');
    this.config = null;
  }

  /**
   * Initialize config directory and load config
   */
  init() {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    // Load or create config
    if (fs.existsSync(this.configFile)) {
      this.load();
    } else {
      this.config = this.getDefaultConfig();
      this.save();
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      port: 3030,
      host: 'localhost',
      projects: [],
      autoDiscoverProjects: false,
      scanPaths: [],
      ui: {
        theme: 'dark',
        defaultView: 'overview',
        refreshInterval: 5000
      }
    };
  }

  /**
   * Load configuration from file
   */
  load() {
    try {
      const data = fs.readFileSync(this.configFile, 'utf8');
      this.config = JSON.parse(data);

      // Merge with defaults (in case new options were added)
      const defaults = this.getDefaultConfig();
      this.config = { ...defaults, ...this.config };
      this.config.ui = { ...defaults.ui, ...this.config.ui };
    } catch (error) {
      console.error('Failed to load config:', error.message);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Save configuration to file
   */
  save() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save config:', error.message);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  get() {
    if (!this.config) {
      this.init();
    }
    return this.config;
  }

  /**
   * Add a project
   */
  addProject(project) {
    if (!this.config) {
      this.init();
    }

    // Validate project
    if (!project.id || !project.name || !project.path) {
      throw new Error('Project must have id, name, and path');
    }

    // Check if project already exists
    const existingIndex = this.config.projects.findIndex(p => p.id === project.id);
    if (existingIndex !== -1) {
      throw new Error(`Project with id '${project.id}' already exists`);
    }

    // Check if path already exists
    const pathExists = this.config.projects.findIndex(p => p.path === project.path);
    if (pathExists !== -1) {
      throw new Error(`Project with path '${project.path}' already exists`);
    }

    // Add project
    this.config.projects.push({
      id: project.id,
      name: project.name,
      path: path.resolve(project.path),
      color: project.color || this.generateColor(),
      enabled: project.enabled !== false
    });

    this.save();
  }

  /**
   * Remove a project
   */
  removeProject(projectId) {
    if (!this.config) {
      this.init();
    }

    const index = this.config.projects.findIndex(p => p.id === projectId);
    if (index === -1) {
      throw new Error(`Project '${projectId}' not found`);
    }

    this.config.projects.splice(index, 1);
    this.save();
  }

  /**
   * Update a project
   */
  updateProject(projectId, updates) {
    if (!this.config) {
      this.init();
    }

    const project = this.config.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error(`Project '${projectId}' not found`);
    }

    // Update allowed fields
    const allowedFields = ['name', 'path', 'color', 'enabled'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        project[field] = updates[field];
      }
    });

    this.save();
  }

  /**
   * Get a project by ID
   */
  getProject(projectId) {
    if (!this.config) {
      this.init();
    }

    return this.config.projects.find(p => p.id === projectId);
  }

  /**
   * Get all projects
   */
  getProjects() {
    if (!this.config) {
      this.init();
    }

    return this.config.projects;
  }

  /**
   * Get enabled projects
   */
  getEnabledProjects() {
    if (!this.config) {
      this.init();
    }

    return this.config.projects.filter(p => p.enabled !== false);
  }

  /**
   * Set configuration value
   */
  set(key, value) {
    if (!this.config) {
      this.init();
    }

    this.config[key] = value;
    this.save();
  }

  /**
   * Generate a random color for a project
   */
  generateColor() {
    const colors = [
      '#FF2D20', // Laravel red
      '#000000', // Next.js black
      '#3178C6', // TypeScript blue
      '#38BDF8', // Tailwind cyan
      '#10B981', // Emerald
      '#F59E0B', // Amber
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#14B8A6', // Teal
      '#6366F1'  // Indigo
    ];

    // Get colors already in use
    const usedColors = this.config.projects.map(p => p.color);

    // Find unused color
    const availableColors = colors.filter(c => !usedColors.includes(c));

    if (availableColors.length > 0) {
      return availableColors[0];
    }

    // If all colors used, return a random one
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Scan paths for CADI projects (auto-discovery)
   */
  async scanForProjects() {
    if (!this.config) {
      this.init();
    }

    if (!this.config.autoDiscoverProjects || this.config.scanPaths.length === 0) {
      return [];
    }

    const discovered = [];

    for (const scanPath of this.config.scanPaths) {
      if (!fs.existsSync(scanPath)) {
        continue;
      }

      try {
        const entries = fs.readdirSync(scanPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }

          const projectPath = path.join(scanPath, entry.name);
          const dbPath = path.join(projectPath, '.claude/project.db');

          // Check if it's a CADI project
          if (fs.existsSync(dbPath)) {
            // Check if already in config
            const exists = this.config.projects.find(p => p.path === projectPath);
            if (!exists) {
              discovered.push({
                id: entry.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                name: entry.name,
                path: projectPath
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning ${scanPath}:`, error.message);
      }
    }

    return discovered;
  }
}

module.exports = ConfigManager;
