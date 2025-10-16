# CADI Monitor

A lightweight monitoring dashboard for CADI-powered projects. Monitor multiple projects simultaneously with real-time updates, track feature progress, and view context documentation—all from a single interface.

## Quick Start (New Installation)

Get up and running in 3 steps:

```bash
# 1. Install dependencies
cd packages/cadi-monitor
npm install

# 2. Link globally (makes 'cadi-monitor' command available everywhere)
npm link

# 3. Initialize and start monitoring
cadi-monitor init
cadi-monitor add ~/path/to/your/project "My Project"
cadi-monitor start --open
```

That's it! The dashboard will open in your browser at http://localhost:3030.

## What CADI Monitor Does

**Monitors your CADI projects** by reading `.claude/project.db` and watching for file changes:
- **Feature Progress** - Track completion status, time estimates, and dependencies
- **Context Documents** - View indexed documentation and token usage
- **Real-time Updates** - See changes as they happen via WebSocket
- **Activity Feed** - Watch file changes and feature completions across all projects

**Read-only and safe** - Never modifies your projects, just observes them.

## Installation

### Prerequisites
- Node.js >= 18.0.0
- A CADI project with `.claude/project.db` database

### Setup

```bash
# Navigate to cadi-monitor
cd packages/cadi-monitor

# Install dependencies
npm install

# Link globally (recommended)
npm link
```

After linking, `cadi-monitor` command will be available system-wide.

## Common Workflows

### First Time Setup
```bash
cadi-monitor init                                    # Create config file
cadi-monitor add ~/my-project "My Project"          # Add your first project
cadi-monitor start --open                           # Start and view dashboard
```

### Adding Multiple Projects
```bash
# Add projects one by one
cadi-monitor add ~/projects/api "API Backend"
cadi-monitor add ~/projects/web "Web Frontend"

# Or auto-discover all CADI projects in a directory
cadi-monitor scan ~/projects --auto-add
```

### Daily Use
```bash
cadi-monitor start --open       # Start server and open browser
cadi-monitor open               # Open browser (if server already running)
cadi-monitor list               # View all monitored projects
cadi-monitor status             # Check project health
```

### Managing Projects
```bash
cadi-monitor list               # See all projects
cadi-monitor disable api        # Temporarily stop monitoring a project
cadi-monitor enable api         # Resume monitoring
cadi-monitor remove api         # Remove from monitoring entirely
```

## Commands Reference

### Essential Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Create config file (run once) | `cadi-monitor init` |
| `add <path> [name]` | Add a project to monitor | `cadi-monitor add ~/my-app "My App"` |
| `start` | Start the monitoring server | `cadi-monitor start --open` |
| `list` | Show all monitored projects | `cadi-monitor list` |
| `status` | Check project health | `cadi-monitor status` |

### Server Commands

| Command | Options | Use When |
|---------|---------|----------|
| `start` | `-p, --port <port>`<br>`-h, --host <host>`<br>`-o, --open` | Start monitoring server<br>Default: http://localhost:3030 |
| `open` | - | Open dashboard in browser |

**Examples:**
```bash
cadi-monitor start                        # Start on default port 3030
cadi-monitor start --open                 # Start and open browser
cadi-monitor start --port 8080            # Use custom port
cadi-monitor start --host 0.0.0.0         # Allow remote access
```

### Project Management Commands

| Command | Options | Use When |
|---------|---------|----------|
| `add <path> [name]` | `-i, --id <id>`<br>`-c, --color <color>` | Add a new project to monitor |
| `remove <id>` | - | Stop monitoring a project (alias: `rm`) |
| `list` | `-a, --all` | View all projects (alias: `ls`) |
| `enable <id>` | - | Resume monitoring a disabled project |
| `disable <id>` | - | Temporarily pause monitoring |
| `scan <path>` | `--auto-add` | Find CADI projects in a directory |

**Examples:**
```bash
# Add projects with custom settings
cadi-monitor add ~/api "API" --id backend --color "#FF2D20"

# Find and add all projects automatically
cadi-monitor scan ~/projects --auto-add

# Manage existing projects
cadi-monitor list                         # See all projects
cadi-monitor disable backend              # Pause monitoring
cadi-monitor enable backend               # Resume monitoring
cadi-monitor remove backend               # Remove entirely
```

### Configuration Commands

| Command | Options | Use When |
|---------|---------|----------|
| `init` | `-f, --force` | Create/reset config file |
| `config` | - | View current configuration |
| `status` | - | Check project health and connectivity |

**Examples:**
```bash
cadi-monitor init                         # First-time setup
cadi-monitor init --force                 # Reset to defaults
cadi-monitor config                       # View settings
cadi-monitor status                       # Health check
```

## Use Cases

### Solo Developer
**Scenario:** You're working on a personal project and want to track progress.
```bash
cadi-monitor init
cadi-monitor add ~/my-side-project "Side Project"
cadi-monitor start --open
```
View feature completion, track time estimates, and see your documentation coverage in real-time.

### Full-Stack Developer
**Scenario:** You're managing both backend API and frontend app.
```bash
cadi-monitor init
cadi-monitor add ~/projects/api "Backend API"
cadi-monitor add ~/projects/web "Web App"
cadi-monitor start --open
```
Monitor both projects simultaneously. See when features complete, identify blockers, and ensure documentation stays in sync.

### Team Lead
**Scenario:** You need oversight of all team projects.
```bash
cadi-monitor scan ~/team-projects --auto-add
cadi-monitor start --host 0.0.0.0  # Allow team access
```
Get a bird's-eye view of velocity, track dependencies, and spot issues early across all projects.

### CI/CD Integration
**Scenario:** Integrate monitoring into your build pipeline.
```bash
# Use the REST API
curl http://localhost:3030/api/projects/my-app/features
curl http://localhost:3030/api/stats
```
Track build status, test coverage, and deployment readiness via REST API.

## Dashboard Views

The web UI has four main views:

### Overview
Aggregated statistics across all monitored projects:
- Project cards with quick stats
- Active vs completed features count
- Total context documents indexed
- Recent activity summary

### Features
Per-project feature tracking:
- Expandable sections with detailed information
- Status badges: planning → ready → in_progress → completed
- Time tracking: estimated vs actual hours
- Dependencies and verification criteria

### Context
Documentation and knowledge base:
- Indexed documentation by category (backend, frontend, features, plans)
- Token usage estimates per document
- File paths and summaries
- Last indexed timestamps

### Activity
Real-time feed of all changes:
- File modifications across all projects
- Feature and section completions
- Timestamps and project attribution
- Agent activity (when instrumented)

## Configuration

Configuration is stored in `~/.cadi-monitor/config.json`:

```json
{
  "port": 3030,
  "host": "localhost",
  "projects": [
    {
      "id": "laravel-api",
      "name": "Laravel API",
      "path": "/home/user/projects/laravel-api",
      "color": "#FF2D20",
      "enabled": true
    },
    {
      "id": "nextjs-dashboard",
      "name": "Next.js Dashboard",
      "path": "/home/user/projects/nextjs-dashboard",
      "color": "#000000",
      "enabled": true
    }
  ],
  "autoDiscoverProjects": false,
  "scanPaths": [],
  "ui": {
    "theme": "dark",
    "defaultView": "overview",
    "refreshInterval": 5000
  }
}
```

## Project Requirements

For a project to be monitored, it needs:

1. **`.claude/` directory** - The CADI workspace folder
2. **`.claude/project.db`** - SQLite database with CADI schema (features, sections tables)

The monitor automatically reads from:
- `.claude/project.db` - Feature and section tracking data
- `docs/plans/` - Planning documents (optional)
- `docs/features/` - Implementation documentation (optional)

If your project doesn't have these, it won't appear in the monitor. Use `cadi-monitor status` to diagnose issues.

## Architecture

```
┌─────────────────────────────────────────┐
│  CADI Monitor (Standalone App)         │
│  ┌────────────────────────────────────┐ │
│  │  Web UI (Vanilla HTML/CSS/JS)     │ │
│  └──────────────┬─────────────────────┘ │
│                 │                        │
│  ┌──────────────▼─────────────────────┐ │
│  │  Express Server + WebSocket        │ │
│  │  - SQLite read-only queries        │ │
│  │  - File watcher (docs/, .claude/)  │ │
│  │  - Event stream via WS             │ │
│  └──────────────┬─────────────────────┘ │
└─────────────────┼─────────────────────────┘
                  │
         ┌────────▼────────┐
         │ Any Project     │
         │ .claude/        │
         │ ├─ project.db   │◄── Read-only
         │ ├─ agents/      │◄── Watched
         │ └─ commands/    │
         └─────────────────┘
```

### Components

- **ProjectMonitor** - Monitors a single project (SQLite + file watcher)
- **ConfigManager** - Manages multi-project configuration
- **MonitorServer** - Express + WebSocket server
- **Web UI** - Vanilla JavaScript dashboard (no build step)
- **CLI** - Command-line interface for management

## REST API

The server exposes a REST API for integration:

```bash
# Health check
GET /api/health

# Get all projects with stats
GET /api/projects

# Get single project
GET /api/projects/:id

# Get features for a project
GET /api/projects/:id/features

# Get sections for a feature
GET /api/projects/:id/features/:featureId/sections

# Get context documents
GET /api/projects/:id/context

# Get aggregated stats
GET /api/stats

# Get configuration
GET /api/config

# Add a project
POST /api/config/projects
Body: { id, name, path, color, enabled }

# Remove a project
DELETE /api/config/projects/:id
```

## WebSocket Events

Subscribe to real-time events:

```javascript
const ws = new WebSocket('ws://localhost:3030');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'connected':
      // Connection established
      break;

    case 'fileChange':
      // File changed in project
      // data: { projectId, projectName, eventType, file, timestamp }
      break;

    case 'statsChanged':
      // Project stats updated
      // data: { projectId, projectName, oldStats, newStats, timestamp }
      break;

    case 'projectInitialized':
      // New project added
      break;
  }
};

// Subscribe to specific projects
ws.send(JSON.stringify({
  type: 'subscribe',
  projects: ['laravel-api', 'nextjs-dashboard']
}));
```


## Troubleshooting

### Server won't start
- Check if port 3030 is already in use
- Verify Node.js version (requires >= 18.0.0)
- Check console for error messages

### Project not appearing
- Verify `.claude/project.db` exists
- Check database has required tables (features, sections)
- Run `cadi-monitor status` to check project health

### No real-time updates
- Check WebSocket connection in browser console
- Verify firewall isn't blocking WebSocket connections
- Try refreshing the page

### Database errors
- Ensure database isn't locked by another process
- Check database integrity: `sqlite3 .claude/project.db "PRAGMA integrity_check"`
- Re-run project initialization if needed

## Development

### Project Structure

```
packages/cadi-monitor/
├── bin/
│   └── cli.js              # Command-line interface
├── src/
│   ├── server.js           # Express + WebSocket server
│   ├── ProjectMonitor.js   # Project monitoring class
│   └── ConfigManager.js    # Configuration management
├── public/
│   ├── index.html          # Main UI
│   ├── css/
│   │   └── style.css       # Styles
│   └── js/
│       └── app.js          # Client-side logic
├── package.json
└── README.md
```

### Running in Development

```bash
# Install dependencies
npm install

# Start server with auto-reload
npm run dev

# Run CLI locally
node bin/cli.js <command>
```

### Adding Features

The codebase is designed to be extensible:

1. **New API endpoints** - Add to `src/server.js`
2. **Database queries** - Add to `ProjectMonitor.js`
3. **UI views** - Update `public/index.html` and `public/js/app.js`
4. **CLI commands** - Add to `bin/cli.js`

## Roadmap

- [ ] Agent execution tracking and logging
- [ ] Performance metrics per agent
- [ ] Error tracking and alerting
- [ ] Export reports (CSV, JSON, PDF)
- [ ] Dark/light theme toggle
- [ ] Custom dashboard layouts
- [ ] Slack/Discord notifications
- [ ] Historical data and trends
- [ ] Project comparison views
- [ ] API authentication

## Contributing

Contributions welcome! This is part of the CADI project ecosystem.

## License

MIT

## Support

For issues, questions, or feature requests, please open an issue in the repository.

---

Built with ❤️ for the CADI community
