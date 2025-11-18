#!/bin/bash

# Documentation Indexer
# Scans documentation files and indexes them in the SQLite database

set -e

# Configuration
DB_PATH=".claude/project.db"
DOCS_ROOT="docs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Statistics
NEW_COUNT=0
UPDATED_COUNT=0
SKIPPED_COUNT=0
ERROR_COUNT=0

echo -e "${BLUE}📚 Starting documentation indexing...${NC}\n"

# Function to infer category from path
infer_category() {
    local filepath="$1"

    if [[ "$filepath" == *"/backend/"* ]]; then
        echo "backend"
    elif [[ "$filepath" == *"/frontend/"* ]] || [[ "$filepath" == *"/design/"* ]]; then
        echo "frontend"
    elif [[ "$filepath" == *"/features/"* ]]; then
        echo "feature"
    elif [[ "$filepath" == *"/plan"* ]] || [[ "$filepath" == *"/scrum/"* ]]; then
        echo "plan"
    else
        echo "backend"
    fi
}

# Function to extract title from file
extract_title() {
    local filepath="$1"

    # Try to get first heading
    local heading=$(head -20 "$filepath" | grep -m 1 "^# " | sed 's/^# //' || echo "")

    if [ -n "$heading" ]; then
        echo "$heading"
    else
        # Fall back to filename
        basename "$filepath" .md | sed 's/[-_]/ /g'
    fi
}

# Function to extract summary
extract_summary() {
    local filepath="$1"

    # Remove frontmatter and get first paragraph
    local content=$(sed '/^---$/,/^---$/d' "$filepath" | grep -v "^#" | grep -v "^$" | head -5 | tr '\n' ' ')

    # Truncate to 200 chars
    echo "${content:0:200}..."
}

# Function to estimate tokens
estimate_tokens() {
    local filepath="$1"
    local words=$(wc -w < "$filepath")
    echo $(( words * 13 / 10 ))
}

# Function to escape SQL strings
sql_escape() {
    echo "$1" | sed "s/'/''/g"
}

# Get all markdown files
mapfile -t files < <(find "$DOCS_ROOT" -name "*.md" -type f | sort)

echo -e "Found ${#files[@]} markdown files\n"

# Process each file
for filepath in "${files[@]}"; do
    # Get file modification time
    mod_time=$(stat -c %Y "$filepath")

    # Check if already indexed
    last_indexed=$(sqlite3 "$DB_PATH" "SELECT last_indexed FROM context_documents WHERE file_path = '$filepath'" 2>/dev/null || echo "")

    # Convert last_indexed to timestamp for comparison
    if [ -n "$last_indexed" ]; then
        last_indexed_ts=$(date -d "$last_indexed" +%s 2>/dev/null || echo "0")

        if [ "$mod_time" -le "$last_indexed_ts" ]; then
            echo -e "${YELLOW}⏭️  Skipping (unchanged): $filepath${NC}"
            ((SKIPPED_COUNT++))
            continue
        fi
    fi

    # Extract metadata
    title=$(extract_title "$filepath")
    category=$(infer_category "$filepath")
    summary=$(extract_summary "$filepath")
    tokens=$(estimate_tokens "$filepath")

    # Escape for SQL
    title_esc=$(sql_escape "$title")
    summary_esc=$(sql_escape "$summary")

    # Insert/update in database
    sql="INSERT OR REPLACE INTO context_documents
         (file_path, title, category, summary, tags, feature_id, estimated_tokens, file_modified, last_indexed)
         VALUES ('$filepath', '$title_esc', '$category', '$summary_esc', NULL, NULL, $tokens, $mod_time, datetime('now'));"

    if sqlite3 "$DB_PATH" "$sql" 2>/dev/null; then
        if [ -n "$last_indexed" ]; then
            echo -e "${GREEN}✅ Updated: $filepath${NC}"
            echo -e "   Title: $title"
            echo -e "   Category: $category"
            echo -e "   Tokens: $tokens\n"
            ((UPDATED_COUNT++))
        else
            echo -e "${GREEN}🆕 New: $filepath${NC}"
            echo -e "   Title: $title"
            echo -e "   Category: $category"
            echo -e "   Tokens: $tokens\n"
            ((NEW_COUNT++))
        fi
    else
        echo -e "${RED}❌ Error processing: $filepath${NC}\n"
        ((ERROR_COUNT++))
    fi
done

# Clean up orphaned entries
echo -e "\n${BLUE}🧹 Checking for orphaned entries...${NC}"
orphaned=$(sqlite3 "$DB_PATH" "SELECT file_path FROM context_documents" | while read dbpath; do
    if [ ! -f "$dbpath" ]; then
        echo "$dbpath"
    fi
done)

ORPHANED_COUNT=0
if [ -n "$orphaned" ]; then
    while IFS= read -r dbpath; do
        sqlite3 "$DB_PATH" "DELETE FROM context_documents WHERE file_path = '$dbpath'"
        echo -e "   ${YELLOW}Removed: $dbpath${NC}"
        ((ORPHANED_COUNT++))
    done <<< "$orphaned"
fi

# Get statistics
echo -e "\n============================================================"
echo -e "${BLUE}📊 INDEXING SUMMARY${NC}"
echo -e "============================================================"
echo -e "\n🆕 New documents:       $NEW_COUNT"
echo -e "✏️  Updated documents:   $UPDATED_COUNT"
echo -e "⏭️  Skipped (unchanged): $SKIPPED_COUNT"
echo -e "🧹 Removed (orphaned):  $ORPHANED_COUNT"
echo -e "❌ Errors:              $ERROR_COUNT"

echo -e "\n------------------------------------------------------------"
echo -e "${BLUE}📁 CATEGORY BREAKDOWN${NC}"
echo -e "------------------------------------------------------------"

sqlite3 "$DB_PATH" -column -header "
SELECT
    category,
    COUNT(*) as docs,
    SUM(estimated_tokens) as tokens
FROM context_documents
GROUP BY category
UNION ALL
SELECT
    'TOTAL' as category,
    COUNT(*) as docs,
    SUM(estimated_tokens) as tokens
FROM context_documents
ORDER BY
    CASE category
        WHEN 'backend' THEN 1
        WHEN 'frontend' THEN 2
        WHEN 'feature' THEN 3
        WHEN 'plan' THEN 4
        WHEN 'TOTAL' THEN 99
    END;"

echo -e "============================================================\n"
