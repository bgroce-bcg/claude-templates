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
    read -p "Do you want to update it? This will overwrite existing base files. (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping base configuration update."
        echo -e "${BLUE}Will only add framework-specific configurations if requested...${NC}"
    else
        echo -e "${BLUE}Updating base Claude configuration...${NC}"

        # Create directories if they don't exist
        mkdir -p "$TARGET_DIR/.claude/agents"
        mkdir -p "$TARGET_DIR/.claude/commands"

        # Copy base files (will overwrite)
        cp -r "$BASE_CLAUDE_DIR/"* "$TARGET_DIR/.claude/"

        # Remove Windows Zone.Identifier files if they exist
        find "$TARGET_DIR/.claude" -name "*:Zone.Identifier" -delete 2>/dev/null || true

        echo -e "${GREEN}✓ Updated .claude directory${NC}"
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
echo "  docs/backend/    - Backend documentation"
echo "  docs/frontend/   - Frontend documentation"
echo "  docs/plans/      - Project plans"
echo "  docs/features/   - Feature documentation"
