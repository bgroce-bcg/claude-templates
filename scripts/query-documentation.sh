#!/bin/bash

# Documentation Query Tool
# Query indexed documentation from the SQLite database

set -e

# Configuration
DB_PATH=".claude/project.db"

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse command line arguments
LIST_ONLY=false
CATEGORY=""
TAGS=""
FEATURE=""
REQUEST=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --list-only)
            LIST_ONLY=true
            shift
            ;;
        --category)
            CATEGORY="$2"
            shift 2
            ;;
        --tags)
            TAGS="$2"
            shift 2
            ;;
        --feature)
            FEATURE="$2"
            shift 2
            ;;
        *)
            REQUEST="$1"
            shift
            ;;
    esac
done

# Build WHERE clause
WHERE_CLAUSE="1=1"

if [ -n "$CATEGORY" ]; then
    WHERE_CLAUSE="$WHERE_CLAUSE AND category = '$CATEGORY'"
fi

if [ -n "$REQUEST" ]; then
    REQUEST_LOWER=$(echo "$REQUEST" | tr '[:upper:]' '[:lower:]')
    WHERE_CLAUSE="$WHERE_CLAUSE AND (
        LOWER(title) LIKE '%$REQUEST_LOWER%' OR
        LOWER(summary) LIKE '%$REQUEST_LOWER%' OR
        LOWER(tags) LIKE '%$REQUEST_LOWER%'
    )"
fi

# Execute query
if [ "$LIST_ONLY" = true ]; then
    echo -e "${BLUE}📚 Documentation Query Results${NC}\n"

    # Get matching documents
    sqlite3 "$DB_PATH" -box -header "
    SELECT
        id,
        substr(title, 1, 35) || CASE WHEN length(title) > 35 THEN '...' ELSE '' END as title,
        category,
        estimated_tokens as tokens,
        substr(file_path, 6, 40) || CASE WHEN length(file_path) > 45 THEN '...' ELSE '' END as path
    FROM context_documents
    WHERE $WHERE_CLAUSE
    ORDER BY category, title;"

    # Get totals
    echo ""
    sqlite3 "$DB_PATH" "
    SELECT
        '${YELLOW}Total: ' || COUNT(*) || ' documents, ' || SUM(estimated_tokens) || ' estimated tokens${NC}'
    FROM context_documents
    WHERE $WHERE_CLAUSE;"

else
    echo -e "${BLUE}📚 Loading Documentation...${NC}\n"

    # Get document IDs and paths
    mapfile -t doc_info < <(sqlite3 "$DB_PATH" -separator '|' "
    SELECT file_path, title, estimated_tokens
    FROM context_documents
    WHERE $WHERE_CLAUSE
    ORDER BY category, title;")

    if [ ${#doc_info[@]} -eq 0 ]; then
        echo -e "${YELLOW}No documents match your query.${NC}"
        exit 0
    fi

    echo -e "${GREEN}Found ${#doc_info[@]} matching documents${NC}\n"

    total_tokens=0

    # Read and display each document
    for doc in "${doc_info[@]}"; do
        IFS='|' read -r filepath title tokens <<< "$doc"
        total_tokens=$((total_tokens + tokens))

        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}📄 $title${NC}"
        echo -e "${YELLOW}   Path: $filepath (${tokens} tokens)${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

        if [ -f "$filepath" ]; then
            cat "$filepath"
        else
            echo -e "${RED}❌ File not found: $filepath${NC}"
        fi

        echo -e "\n"
    done

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Loaded ${#doc_info[@]} documents (${total_tokens} estimated tokens)${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
fi
