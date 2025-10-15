# CADI Monitor

A lightweight, framework-agnostic monitoring dashboard for CADI-powered projects. Monitor multiple projects simultaneously with real-time updates, track feature progress, view context documentation, and observe agent activity—all from a single interface.

## Features

- **Multi-Project Monitoring** - Monitor multiple CADI projects from a single dashboard
- **Real-time Updates** - WebSocket-based live updates when project state changes
- **Framework Agnostic** - Works with Laravel, Next.js, standalone projects, or any framework
- **Lightweight** - Minimal dependencies, no build step required for UI
- **Read-Only** - Safely monitors your projects without modifying them
- **Zero Configuration** - Just point it to your project directories

## What It Monitors

### Feature Progress
- Feature and section status tracking
- Time estimates vs actual time spent
- Dependencies between sections
- Completion timelines

### Context & Documentation
- Indexed documentation
- Token usage per document
- Documentation categories (backend, frontend, features, plans)
- Last indexed timestamps

### Project Health
- Database integrity checks
- File system monitoring
- Real-time change detection

### Activity Feed
- File changes across all projects
- Feature and section completions
- Agent executions (future)

## Installation

### From Source

```bash
# Clone or navigate to the repository
cd packages/cadi-monitor

# Install dependencies
npm install

# Link globally (optional)
npm link

# Or run directly
node bin/cli.js --help
```

### As Package (Future)

```bash
npm install -g @cadi/monitor
```

## Quick Start

### 1. Initialize Configuration

```bash
cadi-monitor init
```

This creates `~/.cadi-monitor/config.json` with default settings.

### 2. Add Your Projects

```bash
# Add a single project
cadi-monitor add ~/projects/my-laravel-app "Laravel API"

# Add another project
cadi-monitor add ~/projects/my-nextjs-app "Next.js Dashboard"

# Or scan a directory for CADI projects
cadi-monitor scan ~/projects --auto-add
```

### 3. Start the Server

```bash
# Start server (default: http://localhost:3030)
cadi-monitor start

# Start and open browser automatically
cadi-monitor start --open

# Custom port and host
cadi-monitor start --port 8080 --host 0.0.0.0
```

### 4. Open the Dashboard

```bash
# Open in browser
cadi-monitor open

# Or navigate manually to http://localhost:3030
```

## CLI Commands

### Server Management

```bash
# Start the monitor server
cadi-monitor start [options]
  -p, --port <port>    Port to run on (default: 3030)
  -h, --host <host>    Host to bind to (default: localhost)
  -o, --open           Open browser after starting

# Open the UI in browser
cadi-monitor open
```

### Project Management

```bash
# Add a project
cadi-monitor add <path> [name] [options]
  -i, --id <id>        Project ID (default: directory name)
  -c, --color <color>  Project color (hex code)

# Remove a project
cadi-monitor remove <id>
cadi-monitor rm <id>

# List all projects
cadi-monitor list
cadi-monitor ls
  -a, --all           Show all projects including disabled

# Enable/disable a project
cadi-monitor enable <id>
cadi-monitor disable <id>

# Scan for projects
cadi-monitor scan <path> [options]
  --auto-add          Automatically add discovered projects
```

### Configuration

```bash
# Initialize configuration
cadi-monitor init
  -f, --force         Overwrite existing configuration

# Show current configuration
cadi-monitor config

# Show status
cadi-monitor status
```

## Dashboard Views

### Overview
- Aggregated statistics across all projects
- Project cards with quick stats
- Active vs completed features
- Total context documents

### Features
- Per-project feature breakdown
- Expandable sections with detailed info
- Status badges (planning, ready, in_progress, completed)
- Time tracking (estimated vs actual hours)
- Dependencies and verification criteria

### Context
- Indexed documentation by category
- Token estimates per document
- File paths and summaries
- Last indexed timestamps

### Activity
- Real-time feed of changes across all projects
- File modifications
- Feature/section completions
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

For a project to be monitored, it must have:

1. A `.claude/` directory
2. A `.claude/project.db` SQLite database with the CADI schema

The monitor will automatically detect and read from:
- `.claude/project.db` - Feature and section data
- `docs/plans/` - Planning documents
- `docs/features/` - Implementation documentation

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

## Use Cases

### Scenario 1: Full-Stack Developer
Monitor your backend API and frontend app simultaneously. See when features complete, track documentation coverage, and spot issues early.

### Scenario 2: Team Lead
Get a bird's-eye view of all team projects. Track velocity, identify blockers, and ensure documentation standards are met.

### Scenario 3: Solo Developer
Keep tabs on multiple side projects. Quickly see what's in progress, what needs attention, and overall project health.

### Scenario 4: CI/CD Integration
Use the REST API to integrate with your CI/CD pipeline. Track build status, test coverage, and deployment progress.

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
