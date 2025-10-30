# Context Loading Improvements

## Summary

Enhanced the context loader system to support **selective document loading** with a two-step discover-then-load workflow. Users can now browse available documentation and choose specific documents to load, avoiding the "load everything" problem.

## What Changed

### 1. New Command: `/discover-context`

**Purpose:** Browse available documentation without loading full content

**Features:**
- Lists documents with ID, title, category, tags, summary, and token estimate
- Supports filtering by category, tags, feature, and search terms
- Shows total estimated tokens for matched documents
- Returns metadata only (uses `list_only=true`)

**Location:** `/base-claude/commands/cadi/context/discover-context.md`

**Example Usage:**
```bash
# Discover all docs
/discover-context

# Find API docs
/discover-context api

# Filter by category
/discover-context --category=backend

# Filter by tags
/discover-context --tags=api,validation

# Combined
/discover-context authentication --category=backend --tags=api
```

**Example Output:**
```
Found 4 matching documents:

| ID | Title                    | Category | Tags                  | Tokens | Summary                    |
|----|--------------------------|----------|-----------------------|--------|----------------------------|
| 1  | Backend API Architecture | backend  | api,rest,architecture | 650    | RESTful API patterns...    |
| 2  | Database Patterns        | backend  | database,models,orm   | 550    | ORM and query patterns...  |

Total estimated tokens: 1200

To load specific documents, use:
/load-context --ids=1,2
```

### 2. Enhanced Command: `/load-context`

**New Feature:** Load specific documents by ID

**Location:** `/base-claude/commands/cadi/context/load-context.md`

**New Usage:**
```bash
# Load specific documents (NEW)
/load-context --ids=1,2,5

# Old methods still work
/load-context backend
/load-context frontend
/load-context feature guests
```

**Changes:**
- Added `--ids=<comma-separated-ids>` parameter
- When `--ids` provided, ignores category/tag/feature filters
- Updated workflow to parse `--ids` flag first
- Added recommended workflow section

### 3. Enhanced Agent: `context-loader`

**New Variable:** `ids` parameter

**Location:** `/base-claude/agents/cadi/context/context-loader.md`

**Changes:**
- Added `ids` variable to agent definition
- Updated Step 3 (Query Documentation) to handle ID-based queries
- When `ids` provided: `SELECT * FROM context_documents WHERE id IN (...)`
- When `ids` provided, other filters (category, tags, feature) are ignored
- Updated usage examples to show ID-based loading
- Updated agent description in frontmatter

**SQL Query Logic:**
```sql
-- If ids provided (priority)
SELECT * FROM context_documents WHERE id IN (1, 2, 5);

-- Otherwise, use filters
SELECT * FROM context_documents
WHERE category = 'backend'
AND tags LIKE '%api%'
ORDER BY category, title;
```

### 4. Documentation: Selective Context Loading Guide

**Purpose:** Comprehensive guide for users

**Location:** `/docs/examples/selective-context-loading.md`

**Includes:**
- Problem statement (loading too much context)
- Solution overview (two-step workflow)
- Step-by-step instructions
- Use cases with examples
- Benefits summary
- Backward compatibility notes
- Database schema reference
- Tips for adding custom documentation

## Recommended Workflow

### Old Way (Still Supported)
```bash
/load-context backend  # Loads ALL backend docs
```

### New Way (Selective)
```bash
# Step 1: Discover
/discover-context --category=backend

# Step 2: Review the list and token estimates

# Step 3: Load only what you need
/load-context --ids=1,2
```

## Benefits

1. **Token Efficiency**: Load only required documents (example: 1200 tokens instead of 3650)
2. **Reduced Context Clutter**: No irrelevant documentation
3. **Better Control**: See exactly what's available before committing tokens
4. **Cost Savings**: Fewer tokens = lower API costs
5. **Faster Processing**: Less context to process
6. **Budget Management**: Stay within token limits by checking estimates first

## Use Cases

### Exclude Frontend Docs
```bash
/discover-context --category=backend
/load-context --ids=1,2  # Only backend, no frontend clutter
```

### Focus on Specific Topic
```bash
/discover-context validation
/load-context --ids=2,4  # Only validation-related docs
```

### Feature-Specific Context
```bash
/discover-context --feature=guests
/load-context feature guests  # All docs for "guests" feature
```

### Token Budget Management
```bash
/discover-context --category=backend
# Check total tokens in output
# Select subset to stay under budget
/load-context --ids=1,3,5
```

## Backward Compatibility

✅ All existing commands still work:
- `/load-context` (loads both backend and frontend)
- `/load-context backend` (loads all backend docs)
- `/load-context frontend` (loads all frontend docs)
- `/load-context feature FEATURE_NAME` (loads feature-specific docs)

The new `--ids` parameter and `/discover-context` command are **additions**, not replacements.

## Database Schema (No Changes Required)

The existing `context_documents` table already supports this functionality:

```sql
CREATE TABLE context_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Used for --ids parameter
    file_path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT,
    summary TEXT,
    tags TEXT,
    feature_id INTEGER,
    estimated_tokens INTEGER,
    file_modified INTEGER,
    last_indexed INTEGER,
    FOREIGN KEY (feature_id) REFERENCES features(id)
);
```

## Testing

The system was tested with existing database records:

```
Database contents:
- 2 backend docs (1200 tokens total): IDs 1, 2
- 2 frontend docs (2450 tokens total): IDs 3, 4

Test workflow:
1. /discover-context --category=backend
   → Shows IDs 1, 2 with 1200 tokens total
2. /load-context --ids=1,2
   → Loads only backend docs, excludes frontend
```

## Files Modified

1. **Created:** `/base-claude/commands/cadi/context/discover-context.md` (new command)
2. **Modified:** `/base-claude/commands/cadi/context/load-context.md` (added --ids parameter)
3. **Modified:** `/base-claude/agents/cadi/context/context-loader.md` (added ids variable and query logic)
4. **Created:** `/docs/examples/selective-context-loading.md` (user guide)
5. **Created:** `/CONTEXT_LOADING_IMPROVEMENTS.md` (this file)

## Next Steps (Optional Enhancements)

Future improvements could include:

1. **Context Preview**: Show first 100 chars of document content in discovery
2. **Tag Autocomplete**: List all available tags in the database
3. **Smart Recommendations**: Suggest related documents based on current context
4. **Load History**: Remember recently loaded docs to avoid duplication
5. **Batch Operations**: `/load-context --tags=api --exclude-ids=3,4`
6. **Cost Estimation**: Show estimated API cost before loading
7. **Category Statistics**: `/discover-context --stats` to show category breakdown
8. **Export Metadata**: Export document list to JSON for external processing

## Migration Guide

No migration needed! The changes are fully backward compatible.

To start using selective loading:
1. Run `/discover-context` to explore available docs
2. Note the document IDs you need
3. Run `/load-context --ids=<your-ids>`

That's it!
