#!/bin/bash

# Claude Project Health Check Script
# Usage: ./health-check.sh [target-directory]
# If no target directory is provided, checks current directory

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine target directory
TARGET_DIR="${1:-.}"
cd "$TARGET_DIR"

echo -e "${BLUE}Claude Project Health Check${NC}"
echo -e "${BLUE}Checking: $(pwd)${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Check required directories
echo "Checking directory structure..."

if [ ! -d ".claude" ]; then
    echo -e "${RED}✗ .claude directory not found${NC}"
    echo -e "  ${YELLOW}Run: init-claude-project.sh to initialize${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ .claude directory exists${NC}"
fi

if [ ! -d ".claude/agents" ]; then
    echo -e "${RED}✗ .claude/agents directory not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ .claude/agents directory exists${NC}"
fi

if [ ! -d ".claude/commands" ]; then
    echo -e "${RED}✗ .claude/commands directory not found${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ .claude/commands directory exists${NC}"
fi

# Check optional docs directories
for dir in "docs/backend" "docs/frontend" "docs/plans" "docs/features"; do
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}⚠ $dir not found (optional but recommended)${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓ $dir exists${NC}"
    fi
done

echo ""

# Check database
echo "Checking database..."

if [ ! -f ".claude/project.db" ]; then
    echo -e "${RED}✗ project.db not found${NC}"
    echo -e "  ${YELLOW}Database needs to be initialized${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ project.db exists${NC}"

    # Check if sqlite3 is available
    if ! command -v sqlite3 &> /dev/null; then
        echo -e "${RED}✗ sqlite3 not installed - cannot verify database${NC}"
        echo -e "  ${YELLOW}Install sqlite3 to use database features${NC}"
        ERRORS=$((ERRORS + 1))
    else
        # Check features table
        if sqlite3 .claude/project.db "SELECT name FROM sqlite_master WHERE type='table' AND name='features';" 2>/dev/null | grep -q "features"; then
            echo -e "${GREEN}✓ features table exists${NC}"
        else
            echo -e "${RED}✗ features table not found${NC}"
            echo -e "  ${YELLOW}Database needs to be reinitialized${NC}"
            ERRORS=$((ERRORS + 1))
        fi

        # Check sections table
        if sqlite3 .claude/project.db "SELECT name FROM sqlite_master WHERE type='table' AND name='sections';" 2>/dev/null | grep -q "sections"; then
            echo -e "${GREEN}✓ sections table exists${NC}"
        else
            echo -e "${RED}✗ sections table not found${NC}"
            echo -e "  ${YELLOW}Database needs to be reinitialized${NC}"
            ERRORS=$((ERRORS + 1))
        fi

        # Check indexes
        if sqlite3 .claude/project.db "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sections_feature_status';" 2>/dev/null | grep -q "idx_sections_feature_status"; then
            echo -e "${GREEN}✓ Database indexes exist${NC}"
        else
            echo -e "${YELLOW}⚠ Database indexes missing (performance may be affected)${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi

        # Test database queries
        FEATURE_COUNT=$(sqlite3 .claude/project.db "SELECT COUNT(*) FROM features;" 2>&1)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Database queries working (found $FEATURE_COUNT features)${NC}"
        else
            echo -e "${RED}✗ Database query failed: $FEATURE_COUNT${NC}"
            ERRORS=$((ERRORS + 1))
        fi

        SECTION_COUNT=$(sqlite3 .claude/project.db "SELECT COUNT(*) FROM sections;" 2>&1)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Database queries working (found $SECTION_COUNT sections)${NC}"
        else
            echo -e "${RED}✗ Database query failed: $SECTION_COUNT${NC}"
            ERRORS=$((ERRORS + 1))
        fi

        # Database integrity check
        INTEGRITY=$(sqlite3 .claude/project.db "PRAGMA integrity_check;" 2>&1)
        if [ "$INTEGRITY" = "ok" ]; then
            echo -e "${GREEN}✓ Database integrity check passed${NC}"
        else
            echo -e "${RED}✗ Database integrity check failed: $INTEGRITY${NC}"
            echo -e "  ${YELLOW}Database may need to be recreated${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    fi
fi

echo ""

# Check key commands
echo "Checking essential commands..."

COMMANDS=(
    "create-plan.md"
    "build.md"
    "complete-plan.md"
    "plan-status.md"
    "test.md"
    "lint.md"
    "commit.md"
)

MISSING_COMMANDS=0
for cmd in "${COMMANDS[@]}"; do
    # Search recursively in .claude/commands directory
    if find ".claude/commands" -type f -name "$cmd" 2>/dev/null | grep -q .; then
        echo -e "${GREEN}✓ $cmd${NC}"
    else
        echo -e "${RED}✗ $cmd not found${NC}"
        MISSING_COMMANDS=$((MISSING_COMMANDS + 1))
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Check essential agents
echo "Checking essential agents..."

AGENTS=(
    "plan-section-builder.md"
    "code-reviewer.md"
    "test-builder.md"
    "git-helper.md"
)

MISSING_AGENTS=0
for agent in "${AGENTS[@]}"; do
    # Search recursively in .claude/agents directory
    if find ".claude/agents" -type f -name "$agent" 2>/dev/null | grep -q .; then
        echo -e "${GREEN}✓ $agent${NC}"
    else
        echo -e "${RED}✗ $agent not found${NC}"
        MISSING_AGENTS=$((MISSING_AGENTS + 1))
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "================================================"
echo -e "${BLUE}Health Check Summary${NC}"
echo "================================================"
echo "Project Root: $(pwd)"

if command -v sqlite3 &> /dev/null && [ -f ".claude/project.db" ]; then
    echo "Features: ${FEATURE_COUNT:-0}"
    echo "Sections: ${SECTION_COUNT:-0}"
fi

echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}  ($WARNINGS warnings)${NC}"
    fi
    echo ""
    echo "Your Claude project is properly configured!"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}  ($WARNINGS warnings)${NC}"
    fi
    echo ""
    echo "Please address the errors above to use Claude project features."
    exit 1
fi
