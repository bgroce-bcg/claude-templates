# Claude Project Templates

This repository contains templates and initialization scripts for setting up new projects with Claude configuration.

## Quick Start

### Basic Initialization
```bash
# Initialize in current directory
./init-claude-project.sh

# Initialize in specific directory
./init-claude-project.sh /path/to/your/project
```

### Framework-Specific Initialization

```bash
# Laravel project
./init-claude-project.sh --laravel

# Next.js project
./init-claude-project.sh --next

# Laravel + Next.js (full-stack)
./init-claude-project.sh --laravel --next

# With custom directory
./init-claude-project.sh --laravel /path/to/project
```

## What Gets Created

The script will:

1. **Always**: Copy `base-claude/` to `.claude/` in your project
2. **With `--laravel`**: Add Laravel-specific agents and commands
3. **With `--next`**: Add Next.js-specific agents and commands
4. **Always**: Create the following directory structure:
   - `docs/backend/` - Backend documentation
   - `docs/frontend/` - Frontend documentation
   - `docs/plans/` - Project plans
   - `docs/features/` - Feature documentation

### Base Configuration
- Commands for general development tasks
- Agents for planning and building

### Laravel Configuration (--laravel)
**Commands:**
- `/artisan` - Run Laravel Artisan commands
- `/test-laravel` - Run PHPUnit/Pest tests

**Agents:**
- `laravel-architect` - Laravel architecture and best practices
- `api-builder` - RESTful API development

### Next.js Configuration (--next)
**Commands:**
- `/dev-next` - Start Next.js dev server
- `/build-next` - Build for production

**Agents:**
- `next-architect` - Next.js App Router architecture
- `react-server-components` - RSC patterns and best practices

## Customization

### Modify Directory Structure

Edit `config.sh` to change which directories are created:

```bash
PROJECT_DIRECTORIES=(
    "docs/backend"
    "docs/frontend"
    "docs/plans"
    "docs/features"
    "your/custom/path"
)
```

Then update `init-claude-project.sh` to source this config file.

### Add Custom Framework Templates

Create a new framework directory (e.g., `django-claude/`):

```bash
mkdir -p your-framework-claude/agents
mkdir -p your-framework-claude/commands
```

Add your custom agents and commands, then update `init-claude-project.sh` to support a new flag.

### Modify Existing Templates

Edit files in the template directories:
- `base-claude/commands/` - Base commands
- `base-claude/agents/` - Base agents
- `laravel-claude/commands/` - Laravel commands
- `laravel-claude/agents/` - Laravel agents
- `next-claude/commands/` - Next.js commands
- `next-claude/agents/` - Next.js agents

## Directory Structure

```
claude-templates/
├── base-claude/           # Base Claude configuration (always included)
│   ├── agents/           # General-purpose agents
│   └── commands/         # General-purpose commands
├── laravel-claude/       # Laravel-specific templates
│   ├── agents/           # Laravel agents
│   └── commands/         # Laravel commands
├── next-claude/          # Next.js-specific templates
│   ├── agents/           # Next.js agents
│   └── commands/         # Next.js commands
├── init-claude-project.sh # Initialization script
├── config.sh             # Configuration file
└── README.md            # This file
```

## Installation

To make the script available globally:

```bash
chmod +x init-claude-project.sh
# Option 1: Add to PATH
echo 'export PATH="$PATH:/home/blgroce/claude-templates"' >> ~/.bashrc
source ~/.bashrc

# Option 2: Create alias
echo 'alias init-claude="/home/blgroce/claude-templates/init-claude-project.sh"' >> ~/.bashrc
source ~/.bashrc
```

Then use it anywhere:
```bash
init-claude-project.sh
# or
init-claude
```
