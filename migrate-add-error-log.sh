#!/bin/bash

# Migration script to add error_log table to existing CADI project databases
# Usage: ./migrate-add-error-log.sh [path-to-project]
# If no path provided, migrates current directory

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TARGET_DIR="${1:-.}"
DB_PATH="$TARGET_DIR/.claude/project.db"

echo -e "${BLUE}CADI Error Log Migration${NC}"
echo ""

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${YELLOW}Error: Database not found at $DB_PATH${NC}"
    echo "This script should be run in a CADI project directory, or provide the path as an argument."
    exit 1
fi

echo "Database: $DB_PATH"
echo ""

# Check if error_log table already exists
TABLE_EXISTS=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='error_log';" || echo "")

if [ ! -z "$TABLE_EXISTS" ]; then
    echo -e "${YELLOW}error_log table already exists. No migration needed.${NC}"
    exit 0
fi

echo -e "${BLUE}Adding error_log table...${NC}"

# Add error_log table
sqlite3 "$DB_PATH" << 'EOF'
CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    agent_name TEXT NOT NULL,
    command_name TEXT,
    feature_id INTEGER,
    section_id INTEGER,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    error_context TEXT,
    resolution TEXT,
    severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    resolved BOOLEAN DEFAULT 0,
    FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_error_timestamp ON error_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_agent ON error_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_error_severity ON error_log(severity);
CREATE INDEX IF NOT EXISTS idx_error_resolved ON error_log(resolved);
CREATE INDEX IF NOT EXISTS idx_error_feature ON error_log(feature_id);
CREATE INDEX IF NOT EXISTS idx_error_section ON error_log(section_id);
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ error_log table added successfully${NC}"
    echo ""
    echo "Verification:"

    # Verify table exists
    TABLES=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    echo "$TABLES" | grep -q "error_log" && echo -e "${GREEN}✓ error_log table exists${NC}" || echo -e "${YELLOW}✗ Verification failed${NC}"

    # Check integrity
    INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;")
    if [ "$INTEGRITY" = "ok" ]; then
        echo -e "${GREEN}✓ Database integrity check passed${NC}"
    else
        echo -e "${YELLOW}Warning: Database integrity check failed: $INTEGRITY${NC}"
    fi

    echo ""
    echo -e "${GREEN}Migration complete!${NC}"
    echo ""
    echo "Agents can now log errors to the error_log table."
    echo "See docs/ERROR-LOGGING.md for usage guide."
else
    echo -e "${YELLOW}✗ Migration failed${NC}"
    exit 1
fi
