#!/bin/bash

# Claude Project Initialization Script
# Usage: ./init-claude-project.sh [OPTIONS] [target-directory]
# Options:
#   --laravel    Add Laravel-specific Claude configuration
#   --next       Add Next.js-specific Claude configuration
# If no target directory is provided, initializes in current directory

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_CLAUDE_DIR="$SCRIPT_DIR/base-claude"
LARAVEL_CLAUDE_DIR="$SCRIPT_DIR/laravel-claude"
NEXT_CLAUDE_DIR="$SCRIPT_DIR/next-claude"

# Parse flags
USE_LARAVEL=false
USE_NEXT=false
TARGET_DIR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --laravel)
            USE_LARAVEL=true
            shift
            ;;
        --next)
            USE_NEXT=true
            shift
            ;;
        *)
            TARGET_DIR="$1"
            shift
            ;;
    esac
done

# Determine target directory
if [ -z "$TARGET_DIR" ]; then
    TARGET_DIR="$(pwd)"
fi

echo -e "${BLUE}Initializing Claude project in: $TARGET_DIR${NC}"

# Check if base-claude exists
if [ ! -d "$BASE_CLAUDE_DIR" ]; then
    echo "Error: base-claude directory not found at $BASE_CLAUDE_DIR"
    exit 1
fi

# Check if .claude directory already exists
if [ -d "$TARGET_DIR/.claude" ]; then
    echo -e "${YELLOW}Warning: .claude directory already exists${NC}"
    echo ""

    # Check for custom agents/commands (files not in cadi/ subdirectory)
    CUSTOM_AGENTS=$(find "$TARGET_DIR/.claude/agents" -maxdepth 1 -type f -name "*.md" 2>/dev/null | wc -l)
    CUSTOM_COMMANDS=$(find "$TARGET_DIR/.claude/commands" -maxdepth 1 -type f -name "*.md" 2>/dev/null | wc -l)

    if [ "$CUSTOM_AGENTS" -gt 0 ] || [ "$CUSTOM_COMMANDS" -gt 0 ]; then
        echo -e "${BLUE}Custom files detected:${NC}"
        [ "$CUSTOM_AGENTS" -gt 0 ] && echo "  - $CUSTOM_AGENTS custom agent(s) in .claude/agents/"
        [ "$CUSTOM_COMMANDS" -gt 0 ] && echo "  - $CUSTOM_COMMANDS custom command(s) in .claude/commands/"
        echo ""
        echo "Options:"
        echo "  1) Backup custom files, install CADI structure (recommended)"
        echo "  2) Skip update (keeps everything as-is)"
        echo ""
        read -p "Choose option (1/2): " -n 1 -r
        echo

        if [[ $REPLY == "1" ]]; then
            # Create backup directory
            BACKUP_DIR="$TARGET_DIR/.claude-backup-$(date +%Y%m%d-%H%M%S)"
            mkdir -p "$BACKUP_DIR/agents"
            mkdir -p "$BACKUP_DIR/commands"

            # Backup custom agents (only top-level files, not cadi/)
            if [ "$CUSTOM_AGENTS" -gt 0 ]; then
                find "$TARGET_DIR/.claude/agents" -maxdepth 1 -type f -name "*.md" -exec cp {} "$BACKUP_DIR/agents/" \; 2>/dev/null
                echo -e "${GREEN}✓ Backed up custom agents to $BACKUP_DIR/agents/${NC}"
            fi

            # Backup custom commands (only top-level files, not cadi/)
            if [ "$CUSTOM_COMMANDS" -gt 0 ]; then
                find "$TARGET_DIR/.claude/commands" -maxdepth 1 -type f -name "*.md" -exec cp {} "$BACKUP_DIR/commands/" \; 2>/dev/null
                echo -e "${GREEN}✓ Backed up custom commands to $BACKUP_DIR/commands/${NC}"
            fi

            # Remove old directories
            rm -rf "$TARGET_DIR/.claude/agents"
            rm -rf "$TARGET_DIR/.claude/commands"

            # Install fresh CADI structure
            mkdir -p "$TARGET_DIR/.claude/agents"
            mkdir -p "$TARGET_DIR/.claude/commands"
            cp -r "$BASE_CLAUDE_DIR/"* "$TARGET_DIR/.claude/"

            # Restore custom files to root of agents/commands (not in cadi/)
            # Skip files that have the same name as CADI files (CADI takes precedence)
            if [ "$CUSTOM_AGENTS" -gt 0 ]; then
                RESTORED_AGENTS=0
                SKIPPED_AGENTS=0
                for file in "$BACKUP_DIR/agents/"*.md; do
                    [ -e "$file" ] || continue
                    filename=$(basename "$file")
                    # Check if a file with this name exists anywhere in the new CADI structure
                    if find "$TARGET_DIR/.claude/agents" -type f -name "$filename" 2>/dev/null | grep -q .; then
                        SKIPPED_AGENTS=$((SKIPPED_AGENTS + 1))
                    else
                        cp "$file" "$TARGET_DIR/.claude/agents/"
                        RESTORED_AGENTS=$((RESTORED_AGENTS + 1))
                    fi
                done
                if [ $RESTORED_AGENTS -gt 0 ]; then
                    echo -e "${GREEN}✓ Restored $RESTORED_AGENTS custom agent(s)${NC}"
                fi
                if [ $SKIPPED_AGENTS -gt 0 ]; then
                    echo -e "${YELLOW}  Skipped $SKIPPED_AGENTS agent(s) with same name as CADI files${NC}"
                fi
            fi

            if [ "$CUSTOM_COMMANDS" -gt 0 ]; then
                RESTORED_COMMANDS=0
                SKIPPED_COMMANDS=0
                for file in "$BACKUP_DIR/commands/"*.md; do
                    [ -e "$file" ] || continue
                    filename=$(basename "$file")
                    # Check if a file with this name exists anywhere in the new CADI structure
                    if find "$TARGET_DIR/.claude/commands" -type f -name "$filename" 2>/dev/null | grep -q .; then
                        SKIPPED_COMMANDS=$((SKIPPED_COMMANDS + 1))
                    else
                        cp "$file" "$TARGET_DIR/.claude/commands/"
                        RESTORED_COMMANDS=$((RESTORED_COMMANDS + 1))
                    fi
                done
                if [ $RESTORED_COMMANDS -gt 0 ]; then
                    echo -e "${GREEN}✓ Restored $RESTORED_COMMANDS custom command(s)${NC}"
                fi
                if [ $SKIPPED_COMMANDS -gt 0 ]; then
                    echo -e "${YELLOW}  Skipped $SKIPPED_COMMANDS command(s) with same name as CADI files${NC}"
                fi
            fi

            find "$TARGET_DIR/.claude" -name "*:Zone.Identifier" -delete 2>/dev/null || true
            echo -e "${GREEN}✓ Updated .claude directory${NC}"
        else
            echo "Skipping base configuration update."
        fi
    else
        # No custom files, safe to clean install
        echo "This will:"
        echo "  - Remove existing .claude/agents/ directory"
        echo "  - Remove existing .claude/commands/ directory"
        echo "  - Install fresh CADI structure"
        echo "  - Preserve .claude/project.db"
        echo ""
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Updating base Claude configuration...${NC}"
            rm -rf "$TARGET_DIR/.claude/agents"
            rm -rf "$TARGET_DIR/.claude/commands"
            mkdir -p "$TARGET_DIR/.claude/agents"
            mkdir -p "$TARGET_DIR/.claude/commands"
            cp -r "$BASE_CLAUDE_DIR/"* "$TARGET_DIR/.claude/"
            find "$TARGET_DIR/.claude" -name "*:Zone.Identifier" -delete 2>/dev/null || true
            echo -e "${GREEN}✓ Updated .claude directory${NC}"
        else
            echo "Skipping base configuration update."
        fi
    fi
else
    # Fresh installation
    echo -e "${BLUE}Copying Claude configuration...${NC}"
    cp -r "$BASE_CLAUDE_DIR" "$TARGET_DIR/.claude"

    # Remove Windows Zone.Identifier files if they exist
    find "$TARGET_DIR/.claude" -name "*:Zone.Identifier" -delete 2>/dev/null || true

    echo -e "${GREEN}✓ Created .claude directory${NC}"
fi

# Add Laravel-specific configuration if requested
if [ "$USE_LARAVEL" = true ]; then
    if [ -d "$LARAVEL_CLAUDE_DIR" ]; then
        echo -e "${BLUE}Adding Laravel-specific configuration...${NC}"

        # Ensure directories exist
        mkdir -p "$TARGET_DIR/.claude/agents"
        mkdir -p "$TARGET_DIR/.claude/commands"

        # Copy Laravel agents (will overwrite if exists)
        if [ -d "$LARAVEL_CLAUDE_DIR/agents" ]; then
            if [ "$(ls -A $LARAVEL_CLAUDE_DIR/agents 2>/dev/null)" ]; then
                cp -n "$LARAVEL_CLAUDE_DIR/agents/"* "$TARGET_DIR/.claude/agents/" 2>/dev/null || true
                echo -e "${GREEN}✓ Added Laravel agents${NC}"
            fi
        fi

        # Copy Laravel commands (will overwrite if exists)
        if [ -d "$LARAVEL_CLAUDE_DIR/commands" ]; then
            if [ "$(ls -A $LARAVEL_CLAUDE_DIR/commands 2>/dev/null)" ]; then
                cp -n "$LARAVEL_CLAUDE_DIR/commands/"* "$TARGET_DIR/.claude/commands/" 2>/dev/null || true
                echo -e "${GREEN}✓ Added Laravel commands${NC}"
            fi
        fi

        # Clean up Zone.Identifier files
        find "$TARGET_DIR/.claude" -name "*:Zone.Identifier" -delete 2>/dev/null || true
    else
        echo -e "${YELLOW}Warning: Laravel template not found at $LARAVEL_CLAUDE_DIR${NC}"
    fi
fi

# Add Next.js-specific configuration if requested
if [ "$USE_NEXT" = true ]; then
    if [ -d "$NEXT_CLAUDE_DIR" ]; then
        echo -e "${BLUE}Adding Next.js-specific configuration...${NC}"

        # Ensure directories exist
        mkdir -p "$TARGET_DIR/.claude/agents"
        mkdir -p "$TARGET_DIR/.claude/commands"

        # Copy Next.js agents (will not overwrite if exists)
        if [ -d "$NEXT_CLAUDE_DIR/agents" ]; then
            if [ "$(ls -A $NEXT_CLAUDE_DIR/agents 2>/dev/null)" ]; then
                cp -n "$NEXT_CLAUDE_DIR/agents/"* "$TARGET_DIR/.claude/agents/" 2>/dev/null || true
                echo -e "${GREEN}✓ Added Next.js agents${NC}"
            fi
        fi

        # Copy Next.js commands (will not overwrite if exists)
        if [ -d "$NEXT_CLAUDE_DIR/commands" ]; then
            if [ "$(ls -A $NEXT_CLAUDE_DIR/commands 2>/dev/null)" ]; then
                cp -n "$NEXT_CLAUDE_DIR/commands/"* "$TARGET_DIR/.claude/commands/" 2>/dev/null || true
                echo -e "${GREEN}✓ Added Next.js commands${NC}"
            fi
        fi

        # Clean up Zone.Identifier files
        find "$TARGET_DIR/.claude" -name "*:Zone.Identifier" -delete 2>/dev/null || true
    else
        echo -e "${YELLOW}Warning: Next.js template not found at $NEXT_CLAUDE_DIR${NC}"
    fi
fi

# Create project directories
echo -e "${BLUE}Creating project directories...${NC}"

DIRECTORIES=(
    "docs/backend"
    "docs/frontend"
    "docs/plans"
    "docs/features"
)

for dir in "${DIRECTORIES[@]}"; do
    mkdir -p "$TARGET_DIR/$dir"
    echo -e "${GREEN}✓ Created $dir${NC}"
done

# Initialize project database
echo -e "${BLUE}Initializing project database...${NC}"

DB_PATH="$TARGET_DIR/.claude/project.db"

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${YELLOW}Warning: sqlite3 not found. Please install sqlite3 to use database features.${NC}"
    echo -e "${YELLOW}Install sqlite3 and re-run this script to create the database.${NC}"
else
    # Create the database with schema
    sqlite3 "$DB_PATH" << 'EOF'
CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    planning_doc_path TEXT NOT NULL,
    summary TEXT,
    status TEXT CHECK(status IN ('planning', 'ready', 'in_progress', 'completed')) DEFAULT 'planning',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feature_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    objectives TEXT,
    verification_criteria TEXT,
    order_index INTEGER NOT NULL,
    status TEXT CHECK(status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',
    depends_on INTEGER,
    estimated_hours REAL,
    actual_hours REAL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on) REFERENCES sections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sections_feature_status ON sections(feature_id, status);
CREATE INDEX IF NOT EXISTS idx_sections_order ON sections(feature_id, order_index);

CREATE TABLE IF NOT EXISTS context_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT,
    tags TEXT,
    feature_id INTEGER,
    estimated_tokens INTEGER,
    last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_modified TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_docs_category ON context_documents(category);
CREATE INDEX IF NOT EXISTS idx_docs_feature ON context_documents(feature_id);
EOF

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Created project.db${NC}"
    else
        echo -e "${YELLOW}Warning: Failed to create project.db${NC}"
        echo -e "${YELLOW}Check that sqlite3 is installed and working properly.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Project initialization complete!${NC}"
echo ""
echo "Installed configurations:"
echo "  ✓ Base Claude configuration"
if [ "$USE_LARAVEL" = true ]; then
    echo "  ✓ Laravel-specific configuration"
fi
if [ "$USE_NEXT" = true ]; then
    echo "  ✓ Next.js-specific configuration"
fi
echo ""
echo "Directory structure:"
echo "  .claude/         - Claude configuration and commands"
echo "  .claude/project.db - Project planning database"
echo "  docs/backend/    - Backend documentation"
echo "  docs/frontend/   - Frontend documentation"
echo "  docs/plans/      - Project plans"
echo "  docs/features/   - Feature documentation"
