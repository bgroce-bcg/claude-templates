#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ConfigManager = require('../src/ConfigManager');
const MonitorServer = require('../src/server');

const program = new Command();
const config = new ConfigManager();

program
  .name('cadi-monitor')
  .description('CADI Monitor - Multi-project dashboard for CADI-powered development')
  .version('1.0.0');

/**
 * Start the monitor server
 */
program
  .command('start')
  .description('Start the monitor server')
  .option('-p, --port <port>', 'Port to run server on', '3030')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .option('-o, --open', 'Open browser after starting')
  .option('-t, --template <path>', 'Path to base-claude template (for updates)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('Starting CADI Monitor...'));

      // Update config with options
      config.init();
      if (options.port) config.set('port', parseInt(options.port));
      if (options.host) config.set('host', options.host);

      // Auto-detect template path if not specified
      let templatePath = options.template;
      if (!templatePath) {
        // Try to find base-claude in parent directories
        const packageDir = path.join(__dirname, '..');
        const repoRoot = path.join(packageDir, '..', '..');
        const baseClaude = path.join(repoRoot, 'base-claude');

        if (fs.existsSync(baseClaude)) {
          templatePath = baseClaude;
          console.log(chalk.dim('Auto-detected template path:'), chalk.cyan(templatePath));
        }
      }

      // Start server
      const server = new MonitorServer(null, templatePath);
      await server.start();

      if (templatePath) {
        console.log(chalk.green('✓ Update system enabled'));
      } else {
        console.log(chalk.dim('Update system disabled (no template path)'));
      }

      // Open browser if requested
      if (options.open) {
        const url = `http://${options.host}:${options.port}`;
        console.log(chalk.blue(`Opening browser to ${url}...`));

        const open = (await import('open')).default;
        await open(url);
      }

      // Keep process alive
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\nShutting down...'));
        await server.stop();
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red('Failed to start server:'), error.message);
      process.exit(1);
    }
  });

/**
 * Initialize configuration
 */
program
  .command('init')
  .description('Initialize CADI Monitor configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .action((options) => {
    try {
      config.init();

      const configPath = path.join(config.configDir, 'config.json');

      if (fs.existsSync(configPath) && !options.force) {
        console.log(chalk.yellow('Configuration already exists at:'), configPath);
        console.log(chalk.dim('Use --force to overwrite'));
        return;
      }

      config.save();

      console.log(chalk.green('✓ Configuration initialized'));
      console.log(chalk.dim('Config location:'), configPath);
      console.log();
      console.log(chalk.blue('Next steps:'));
      console.log('  1. Add a project:', chalk.cyan('cadi-monitor add <path> "<name>"'));
      console.log('  2. Start the server:', chalk.cyan('cadi-monitor start'));
    } catch (error) {
      console.error(chalk.red('Failed to initialize:'), error.message);
      process.exit(1);
    }
  });

/**
 * Add a project
 */
program
  .command('add')
  .description('Add a project to monitor')
  .argument('<path>', 'Path to project directory')
  .argument('[name]', 'Project name (defaults to directory name)')
  .option('-i, --id <id>', 'Project ID (defaults to directory name)')
  .option('-c, --color <color>', 'Project color (hex code)')
  .action((projectPath, projectName, options) => {
    try {
      config.init();

      // Resolve path
      const resolvedPath = path.resolve(projectPath);

      // Check if path exists
      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red('Error: Path does not exist:'), resolvedPath);
        process.exit(1);
      }

      // Check if .claude/project.db exists
      const dbPath = path.join(resolvedPath, '.claude/project.db');
      if (!fs.existsSync(dbPath)) {
        console.error(chalk.red('Error: Not a CADI project'));
        console.error(chalk.dim('Missing:'), dbPath);
        process.exit(1);
      }

      // Generate ID and name if not provided
      const dirName = path.basename(resolvedPath);
      const id = options.id || dirName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const name = projectName || dirName;

      // Add project
      config.addProject({
        id,
        name,
        path: resolvedPath,
        color: options.color,
        enabled: true
      });

      console.log(chalk.green('✓ Project added'));
      console.log();
      console.log('  ID:', chalk.cyan(id));
      console.log('  Name:', chalk.cyan(name));
      console.log('  Path:', chalk.dim(resolvedPath));
      console.log();
      console.log(chalk.blue('Start monitoring:'), chalk.cyan('cadi-monitor start'));
    } catch (error) {
      console.error(chalk.red('Failed to add project:'), error.message);
      process.exit(1);
    }
  });

/**
 * Remove a project
 */
program
  .command('remove')
  .alias('rm')
  .description('Remove a project from monitoring')
  .argument('<id>', 'Project ID to remove')
  .action((projectId) => {
    try {
      config.init();

      const project = config.getProject(projectId);
      if (!project) {
        console.error(chalk.red('Error: Project not found:'), projectId);
        process.exit(1);
      }

      config.removeProject(projectId);

      console.log(chalk.green('✓ Project removed'));
      console.log('  ID:', chalk.cyan(projectId));
      console.log('  Name:', chalk.dim(project.name));
    } catch (error) {
      console.error(chalk.red('Failed to remove project:'), error.message);
      process.exit(1);
    }
  });

/**
 * List projects
 */
program
  .command('list')
  .alias('ls')
  .description('List all monitored projects')
  .option('-a, --all', 'Show all projects including disabled')
  .action((options) => {
    try {
      config.init();

      const projects = options.all ? config.getProjects() : config.getEnabledProjects();

      if (projects.length === 0) {
        console.log(chalk.yellow('No projects configured'));
        console.log();
        console.log(chalk.blue('Add a project:'), chalk.cyan('cadi-monitor add <path> "<name>"'));
        return;
      }

      console.log(chalk.blue(`${projects.length} project(s):`));
      console.log();

      projects.forEach((project, index) => {
        const statusIcon = project.enabled !== false ? chalk.green('●') : chalk.gray('○');
        console.log(`${statusIcon} ${chalk.cyan(project.id)} - ${project.name}`);
        console.log(`  ${chalk.dim(project.path)}`);

        if (index < projects.length - 1) {
          console.log();
        }
      });
    } catch (error) {
      console.error(chalk.red('Failed to list projects:'), error.message);
      process.exit(1);
    }
  });

/**
 * Enable/disable a project
 */
program
  .command('enable')
  .description('Enable a project')
  .argument('<id>', 'Project ID')
  .action((projectId) => {
    try {
      config.init();
      config.updateProject(projectId, { enabled: true });

      console.log(chalk.green('✓ Project enabled:'), projectId);
    } catch (error) {
      console.error(chalk.red('Failed to enable project:'), error.message);
      process.exit(1);
    }
  });

program
  .command('disable')
  .description('Disable a project')
  .argument('<id>', 'Project ID')
  .action((projectId) => {
    try {
      config.init();
      config.updateProject(projectId, { enabled: false });

      console.log(chalk.green('✓ Project disabled:'), projectId);
    } catch (error) {
      console.error(chalk.red('Failed to disable project:'), error.message);
      process.exit(1);
    }
  });

/**
 * Open the web UI
 */
program
  .command('open')
  .description('Open the monitor UI in browser')
  .action(async () => {
    try {
      config.init();
      const cfg = config.get();
      const url = `http://${cfg.host || 'localhost'}:${cfg.port || 3030}`;

      console.log(chalk.blue('Opening browser to:'), url);

      const open = (await import('open')).default;
      await open(url);
    } catch (error) {
      console.error(chalk.red('Failed to open browser:'), error.message);
      console.log(chalk.dim('Make sure the server is running:'), chalk.cyan('cadi-monitor start'));
    }
  });

/**
 * Show configuration
 */
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    try {
      config.init();
      const cfg = config.get();

      console.log(chalk.blue('Configuration:'));
      console.log();
      console.log('  Server:');
      console.log('    Host:', chalk.cyan(cfg.host));
      console.log('    Port:', chalk.cyan(cfg.port));
      console.log();
      console.log('  Projects:', chalk.cyan(cfg.projects.length));
      console.log('  Enabled:', chalk.cyan(cfg.projects.filter(p => p.enabled !== false).length));
      console.log();
      console.log('  Config file:', chalk.dim(path.join(config.configDir, 'config.json')));
    } catch (error) {
      console.error(chalk.red('Failed to read config:'), error.message);
      process.exit(1);
    }
  });

/**
 * Scan for projects
 */
program
  .command('scan')
  .description('Scan directories for CADI projects')
  .argument('<path>', 'Directory to scan')
  .option('--auto-add', 'Automatically add discovered projects')
  .action(async (scanPath, options) => {
    try {
      config.init();

      const resolvedPath = path.resolve(scanPath);

      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red('Error: Path does not exist:'), resolvedPath);
        process.exit(1);
      }

      console.log(chalk.blue('Scanning for CADI projects in:'), resolvedPath);
      console.log();

      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      const discovered = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const projectPath = path.join(resolvedPath, entry.name);
        const dbPath = path.join(projectPath, '.claude/project.db');

        if (fs.existsSync(dbPath)) {
          // Check if already in config
          const existing = config.getProjects().find(p => p.path === projectPath);

          if (!existing) {
            discovered.push({
              id: entry.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
              name: entry.name,
              path: projectPath
            });
          }
        }
      }

      if (discovered.length === 0) {
        console.log(chalk.yellow('No new CADI projects found'));
        return;
      }

      console.log(chalk.green(`Found ${discovered.length} project(s):`));
      console.log();

      discovered.forEach(project => {
        console.log(`  ${chalk.cyan(project.id)} - ${project.name}`);
        console.log(`  ${chalk.dim(project.path)}`);
        console.log();

        if (options.autoAdd) {
          try {
            config.addProject(project);
            console.log(chalk.green('  ✓ Added'));
          } catch (error) {
            console.log(chalk.red('  ✗ Failed:'), error.message);
          }
          console.log();
        }
      });

      if (!options.autoAdd) {
        console.log(chalk.blue('To add these projects:'));
        console.log(chalk.cyan('  cadi-monitor scan <path> --auto-add'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to scan:'), error.message);
      process.exit(1);
    }
  });

/**
 * Show status
 */
program
  .command('status')
  .description('Show status of monitor and projects')
  .action(async () => {
    try {
      config.init();
      const cfg = config.get();

      console.log(chalk.blue('CADI Monitor Status'));
      console.log();

      // Check if server is running
      const serverUrl = `http://${cfg.host || 'localhost'}:${cfg.port || 3030}/api/health`;

      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(serverUrl, { timeout: 2000 });

        if (response.ok) {
          console.log('  Server:', chalk.green('Running'));
          console.log('  URL:', chalk.cyan(`http://${cfg.host}:${cfg.port}`));
        } else {
          console.log('  Server:', chalk.yellow('Not responding'));
        }
      } catch (error) {
        console.log('  Server:', chalk.red('Not running'));
      }

      console.log();
      console.log('  Projects:', chalk.cyan(cfg.projects.length));
      console.log('  Enabled:', chalk.cyan(cfg.projects.filter(p => p.enabled !== false).length));

      // Check project health
      const enabledProjects = cfg.projects.filter(p => p.enabled !== false);

      if (enabledProjects.length > 0) {
        console.log();
        console.log(chalk.blue('Project Health:'));
        console.log();

        enabledProjects.forEach(project => {
          const dbPath = path.join(project.path, '.claude/project.db');
          const exists = fs.existsSync(dbPath);

          const statusIcon = exists ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${statusIcon} ${chalk.cyan(project.id)}`);

          if (!exists) {
            console.log(`    ${chalk.red('Database not found')}`);
          }
        });
      }
    } catch (error) {
      console.error(chalk.red('Failed to check status:'), error.message);
      process.exit(1);
    }
  });

/**
 * Update commands
 */
const updateCmd = program
  .command('update')
  .description('Manage project updates from template');

// Analyze what would change
updateCmd
  .command('check [id]')
  .description('Check what would be updated in project(s)')
  .action(async (projectId) => {
    try {
      config.init();
      const cfg = config.get();
      const serverUrl = `http://${cfg.host || 'localhost'}:${cfg.port || 3030}`;

      const fetch = (await import('node-fetch')).default;

      if (projectId) {
        // Check single project
        const response = await fetch(`${serverUrl}/api/updates/${projectId}/analyze`);
        const analysis = await response.json();

        if (!response.ok) {
          console.error(chalk.red('Error:'), analysis.error);
          process.exit(1);
        }

        console.log(chalk.blue(`Update analysis for ${projectId}:`));
        console.log();
        console.log('  Status:', analysis.safe ? chalk.green('Safe') : chalk.red('Unsafe'));

        if (analysis.errors.length > 0) {
          console.log('  Errors:');
          analysis.errors.forEach(err => console.log(`    ${chalk.red('✗')} ${err}`));
        }

        console.log();
        console.log(`  ${chalk.green('Added:')}`, analysis.changes.added.length);
        console.log(`  ${chalk.yellow('Modified:')}`, analysis.changes.modified.length);
        console.log(`  ${chalk.dim('Unchanged:')}`, analysis.changes.unchanged.length);
        console.log(`  ${chalk.cyan('Custom:')}`, analysis.changes.custom.length);

        if (analysis.changes.added.length > 0) {
          console.log();
          console.log(chalk.green('  New files:'));
          analysis.changes.added.forEach(f => console.log(`    + ${f.path}`));
        }

        if (analysis.changes.modified.length > 0) {
          console.log();
          console.log(chalk.yellow('  Modified files:'));
          analysis.changes.modified.forEach(f => console.log(`    ~ ${f.path}`));
        }
      } else {
        // Check all projects
        const projects = cfg.projects.filter(p => p.enabled !== false);
        const projectIds = projects.map(p => p.id);

        const response = await fetch(`${serverUrl}/api/updates/batch/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projects: projectIds })
        });

        const results = await response.json();

        console.log(chalk.blue('Update analysis for all projects:'));
        console.log();

        for (const [id, analysis] of Object.entries(results)) {
          const project = projects.find(p => p.id === id);
          const statusIcon = analysis.safe ? chalk.green('✓') : chalk.red('✗');
          const updateCount = analysis.changes.added.length + analysis.changes.modified.length;

          console.log(`${statusIcon} ${chalk.cyan(project.name)} - ${updateCount} update(s)`);
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to check updates:'), error.message);
      console.log(chalk.dim('Make sure the server is running:'), chalk.cyan('cadi-monitor start'));
      process.exit(1);
    }
  });

// Apply updates
updateCmd
  .command('apply [id]')
  .description('Apply updates to project(s)')
  .option('--dry-run', 'Show what would be done without applying')
  .option('--no-backup', 'Skip backup creation')
  .action(async (projectId, options) => {
    try {
      config.init();
      const cfg = config.get();
      const serverUrl = `http://${cfg.host || 'localhost'}:${cfg.port || 3030}`;

      const fetch = (await import('node-fetch')).default;

      const updateOptions = {
        dryRun: options.dryRun || false,
        skipBackup: !options.backup,
        preserveCustom: true
      };

      if (projectId) {
        // Update single project
        console.log(chalk.blue(`Updating ${projectId}...`));

        const response = await fetch(`${serverUrl}/api/updates/${projectId}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateOptions)
        });

        const result = await response.json();

        if (!result.success) {
          console.error(chalk.red('Update failed:'));
          result.errors.forEach(err => console.log(`  ${chalk.red('✗')} ${err}`));
          process.exit(1);
        }

        console.log(chalk.green('✓ Update successful'));
        console.log();
        console.log('  Added:', result.applied.added.length);
        console.log('  Modified:', result.applied.modified.length);
        console.log('  Skipped (custom):', result.applied.skipped.length);

        if (result.backupPath) {
          console.log();
          console.log(chalk.dim('  Backup:'), result.backupPath);
        }
      } else {
        // Update all projects
        const projects = cfg.projects.filter(p => p.enabled !== false);
        const projectIds = projects.map(p => p.id);

        console.log(chalk.blue(`Updating ${projects.length} project(s)...`));
        console.log();

        const response = await fetch(`${serverUrl}/api/updates/batch/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...updateOptions, projects: projectIds })
        });

        const results = await response.json();

        for (const [id, result] of Object.entries(results)) {
          const project = projects.find(p => p.id === id);
          const statusIcon = result.success ? chalk.green('✓') : chalk.red('✗');

          console.log(`${statusIcon} ${chalk.cyan(project.name)}`);

          if (result.success) {
            console.log(`  Added: ${result.applied.added.length}, Modified: ${result.applied.modified.length}`);
          } else {
            result.errors.forEach(err => console.log(`  ${chalk.red(err)}`));
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to apply updates:'), error.message);
      console.log(chalk.dim('Make sure the server is running:'), chalk.cyan('cadi-monitor start'));
      process.exit(1);
    }
  });

// List backups
updateCmd
  .command('backups <id>')
  .description('List backups for a project')
  .action(async (projectId) => {
    try {
      config.init();
      const cfg = config.get();
      const serverUrl = `http://${cfg.host || 'localhost'}:${cfg.port || 3030}`;

      const fetch = (await import('node-fetch')).default;

      const response = await fetch(`${serverUrl}/api/updates/${projectId}/backups`);
      const data = await response.json();

      if (!response.ok) {
        console.error(chalk.red('Error:'), data.error);
        process.exit(1);
      }

      if (data.backups.length === 0) {
        console.log(chalk.yellow('No backups found'));
        return;
      }

      console.log(chalk.blue(`Backups for ${projectId}:`));
      console.log();

      data.backups.forEach((backup, index) => {
        const size = (backup.size / 1024).toFixed(2);
        const date = new Date(backup.timestamp).toLocaleString();

        console.log(`${index + 1}. ${backup.name}`);
        console.log(`   Date: ${date}`);
        console.log(`   Size: ${size} KB`);
        console.log(`   Path: ${chalk.dim(backup.path)}`);
        console.log();
      });
    } catch (error) {
      console.error(chalk.red('Failed to list backups:'), error.message);
      process.exit(1);
    }
  });

// Rollback
updateCmd
  .command('rollback <id> [backup]')
  .description('Rollback a project to a previous backup')
  .action(async (projectId, backupPath) => {
    try {
      config.init();
      const cfg = config.get();
      const serverUrl = `http://${cfg.host || 'localhost'}:${cfg.port || 3030}`;

      const fetch = (await import('node-fetch')).default;

      console.log(chalk.yellow(`Rolling back ${projectId}...`));

      const response = await fetch(`${serverUrl}/api/updates/${projectId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath })
      });

      const result = await response.json();

      if (!result.success) {
        console.error(chalk.red('Rollback failed:'), result.error);
        process.exit(1);
      }

      console.log(chalk.green('✓ Rollback successful'));
      console.log(chalk.dim('  Restored from:'), result.backupPath);
    } catch (error) {
      console.error(chalk.red('Failed to rollback:'), error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
