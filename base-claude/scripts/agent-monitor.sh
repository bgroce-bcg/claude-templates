#!/bin/bash

# Agent Monitor Script
# View agent invocation activity and nesting
# Usage: ./agent-monitor.sh [filter] [filter-value]
# Examples:
#   ./agent-monitor.sh                    # Recent (last 15)
#   ./agent-monitor.sh recent             # Recent (last 15)
#   ./agent-monitor.sh all                # All invocations
#   ./agent-monitor.sh type Explore       # Filter by agent type
#   ./agent-monitor.sh session abc123     # Filter by session
#   ./agent-monitor.sh feature user-auth  # Filter by feature

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Find project root
PROJECT_ROOT=$(pwd)
while [ "$PROJECT_ROOT" != "/" ]; do
    if [ -f "$PROJECT_ROOT/.claude/project.db" ]; then
        break
    fi
    PROJECT_ROOT=$(dirname "$PROJECT_ROOT")
done

if [ ! -f "$PROJECT_ROOT/.claude/project.db" ]; then
    echo -e "${RED}Error: Could not find .claude/project.db${NC}"
    echo "Make sure you're in a CADI project directory"
    exit 1
fi

DB_PATH="$PROJECT_ROOT/.claude/project.db"

# Check if agent logging tables exist
if ! sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_invocations';" | grep -q agent_invocations; then
    echo -e "${RED}Error: Agent logging tables not found${NC}"
    echo ""
    echo "Run this command to initialize agent logging:"
    echo "  node .claude/scripts/migrate-agent-logging.js"
    exit 1
fi

# Parse arguments
FILTER="${1:-recent}"
FILTER_VALUE="${2:-}"

# Build SQL query based on filter
case "$FILTER" in
    recent)
        QUERY="SELECT * FROM agent_activity ORDER BY invoked_at DESC LIMIT 15;"
        DESCRIPTION="Recent activity (last 15 invocations)"
        ;;
    all)
        QUERY="SELECT * FROM agent_activity ORDER BY invoked_at DESC;"
        DESCRIPTION="All agent invocations"
        ;;
    type)
        if [ -z "$FILTER_VALUE" ]; then
            echo -e "${RED}Error: Agent type required${NC}"
            echo "Usage: $0 type <agent-type>"
            echo "Example: $0 type Explore"
            exit 1
        fi
        QUERY="SELECT * FROM agent_activity WHERE agent_type = '$FILTER_VALUE' ORDER BY invoked_at DESC;"
        DESCRIPTION="Agent type: $FILTER_VALUE"
        ;;
    session)
        if [ -z "$FILTER_VALUE" ]; then
            echo -e "${RED}Error: Session ID required${NC}"
            echo "Usage: $0 session <session-id>"
            exit 1
        fi
        QUERY="SELECT * FROM agent_activity WHERE session_id = '$FILTER_VALUE' ORDER BY invoked_at DESC;"
        DESCRIPTION="Session: $FILTER_VALUE"
        ;;
    feature)
        if [ -z "$FILTER_VALUE" ]; then
            echo -e "${RED}Error: Feature name required${NC}"
            echo "Usage: $0 feature <feature-name>"
            exit 1
        fi
        QUERY="SELECT * FROM agent_activity WHERE feature_name = '$FILTER_VALUE' ORDER BY invoked_at DESC;"
        DESCRIPTION="Feature: $FILTER_VALUE"
        ;;
    *)
        echo -e "${RED}Error: Unknown filter: $FILTER${NC}"
        echo ""
        echo "Valid filters:"
        echo "  recent              - Last 15 invocations (default)"
        echo "  all                 - All invocations"
        echo "  type <agent-type>   - Filter by agent type"
        echo "  session <id>        - Filter by session ID"
        echo "  feature <name>      - Filter by feature name"
        exit 1
        ;;
esac

# Execute query and format output
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                          Agent Invocation Activity                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GRAY}Filter: $DESCRIPTION${NC}"
echo ""

# Get data
RESULTS=$(sqlite3 -separator $'\t' "$DB_PATH" "$QUERY")

if [ -z "$RESULTS" ]; then
    echo -e "${YELLOW}No agent invocations found for this filter${NC}"
    echo ""
    echo "Suggestions:"
    echo "  - Make sure hooks are configured in .claude/settings.json"
    echo "  - Try using commands that invoke agents (e.g., /plan)"
    echo "  - Check if agent logging tables exist"
    exit 0
fi

# Count results
COUNT=$(echo "$RESULTS" | wc -l)
COMPLETED=$(echo "$RESULTS" | awk -F'\t' '$7 != "" {count++} END {print count+0}')
IN_PROGRESS=$((COUNT - COMPLETED))

# Display each invocation
INVOCATION_NUM=1
echo "$RESULTS" | while IFS=$'\t' read -r invocation_id agent_type agent_desc parent_agent session_id invoked_at completed_at duration_ms success error_msg feature_name section_name; do
    echo -e "${GREEN}╭─ Invocation #$invocation_id${NC}"
    echo -e "${GREEN}│${NC}"
    echo -e "${GREEN}│${NC}  ${BLUE}Type:${NC}        $agent_type"

    if [ -n "$agent_desc" ]; then
        echo -e "${GREEN}│${NC}  ${BLUE}Task:${NC}        $agent_desc"
    fi

    if [ -n "$parent_agent" ] && [ "$parent_agent" != "null" ]; then
        echo -e "${GREEN}│${NC}  ${BLUE}Parent:${NC}      $parent_agent"
    else
        echo -e "${GREEN}│${NC}  ${BLUE}Parent:${NC}      ${GRAY}None (top-level)${NC}"
    fi

    echo -e "${GREEN}│${NC}  ${BLUE}Session:${NC}     ${GRAY}${session_id:0:12}...${NC}"

    if [ -n "$feature_name" ] && [ "$feature_name" != "null" ]; then
        echo -e "${GREEN}│${NC}  ${BLUE}Feature:${NC}     $feature_name"
    fi

    if [ -n "$section_name" ] && [ "$section_name" != "null" ]; then
        echo -e "${GREEN}│${NC}  ${BLUE}Section:${NC}     $section_name"
    fi

    echo -e "${GREEN}│${NC}  ${BLUE}Invoked:${NC}     $invoked_at"

    if [ -n "$completed_at" ] && [ "$completed_at" != "null" ]; then
        echo -e "${GREEN}│${NC}  ${BLUE}Completed:${NC}   $completed_at"
        echo -e "${GREEN}│${NC}  ${BLUE}Duration:${NC}    ${duration_ms}ms"
        if [ "$success" = "1" ]; then
            echo -e "${GREEN}│${NC}  ${BLUE}Status:${NC}      ${GREEN}✓ Completed${NC}"
        else
            echo -e "${GREEN}│${NC}  ${BLUE}Status:${NC}      ${RED}✗ Failed${NC}"
            if [ -n "$error_msg" ] && [ "$error_msg" != "null" ]; then
                echo -e "${GREEN}│${NC}  ${BLUE}Error:${NC}       $error_msg"
            fi
        fi
    else
        echo -e "${GREEN}│${NC}  ${BLUE}Status:${NC}      ${YELLOW}⏳ In Progress${NC}"
    fi

    echo -e "${GREEN}╰─${NC}"
    echo ""

    INVOCATION_NUM=$((INVOCATION_NUM + 1))
done

# Display summary statistics
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                              Summary Statistics                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BLUE}Total invocations:${NC}  $COUNT"
echo -e "  ${GREEN}Completed:${NC}          $COMPLETED"
echo -e "  ${YELLOW}In Progress:${NC}        $IN_PROGRESS"

# Calculate average duration
if [ "$COMPLETED" -gt 0 ]; then
    AVG_DURATION=$(sqlite3 "$DB_PATH" "SELECT AVG(duration_ms) FROM agent_activity WHERE duration_ms IS NOT NULL;")
    MIN_DURATION=$(sqlite3 "$DB_PATH" "SELECT MIN(duration_ms) FROM agent_activity WHERE duration_ms IS NOT NULL;")
    MAX_DURATION=$(sqlite3 "$DB_PATH" "SELECT MAX(duration_ms) FROM agent_activity WHERE duration_ms IS NOT NULL;")

    # Round to integers
    AVG_DURATION=$(printf "%.0f" "$AVG_DURATION")

    echo ""
    echo -e "  ${BLUE}Average duration:${NC}   ${AVG_DURATION}ms"
    echo -e "  ${BLUE}Fastest:${NC}            ${MIN_DURATION}ms"
    echo -e "  ${BLUE}Slowest:${NC}            ${MAX_DURATION}ms"
fi

# Show agent type breakdown
echo ""
echo -e "${BLUE}Agent Types:${NC}"
sqlite3 -separator $'\t' "$DB_PATH" "
SELECT
    agent_type,
    COUNT(*) as count,
    printf('%.0f', AVG(duration_ms)) as avg_duration
FROM agent_activity
WHERE duration_ms IS NOT NULL
GROUP BY agent_type
ORDER BY count DESC;
" | while IFS=$'\t' read -r agent_type count avg_dur; do
    echo -e "  ${GREEN}•${NC} ${BLUE}$agent_type:${NC} $count invocations (avg: ${avg_dur}ms)"
done

echo ""
