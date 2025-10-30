---
title: Selective Context Loading
category: plan
tags: [context, documentation, workflow]
summary: How to use the two-step context loading workflow to control what documentation gets loaded
---

# Selective Context Loading

This guide demonstrates the new two-step workflow for loading context efficiently.

## The Problem

Previously, when you asked for "backend" context, ALL backend documentation would be loaded into the conversation, even if you only needed specific topics. This wasted tokens and cluttered the context with irrelevant information.

## The Solution

We now have a **discover-then-load** workflow:

### Step 1: Discover Available Documents

Use `/discover-context` to browse available documentation without loading the full content:

```bash
# See all available docs
/discover-context

# Find API-related docs
/discover-context api

# Find backend docs only
/discover-context --category=backend

# Find docs with specific tags
/discover-context --tags=api,validation

# Combined filters
/discover-context authentication --category=backend
```

**Output Example:**
```
Found 4 matching documents:

| ID | Title                    | Category | Tags                  | Tokens | Summary                        |
|----|--------------------------|----------|-----------------------|--------|--------------------------------|
| 1  | Backend API Architecture | backend  | api,rest,architecture | 650    | RESTful API patterns...        |
| 2  | Database Patterns        | backend  | database,models,orm   | 550    | ORM and query patterns...      |
| 3  | Component Patterns       | frontend | react,components,ui   | 1100   | React component architecture...|
| 4  | Form Validation          | frontend | forms,validation      | 1350   | Form validation with React...  |

Total estimated tokens: 3650

To load specific documents, use:
/load-context --ids=1,2,3,4
```

### Step 2: Load Specific Documents

After reviewing the list, load only the documents you need:

```bash
# Load specific documents by ID
/load-context --ids=1,2

# Or load all from a category
/load-context backend
```

**Output Example (when loading IDs 1,2):**
```
Loaded 2 documents (1200 estimated tokens):

--- Backend API Architecture (docs/backend/api-architecture.md) ---
[Full document content here]

--- Database Patterns (docs/backend/database-patterns.md) ---
[Full document content here]

Context loading complete.
```

## Use Cases

### Use Case 1: Exclude Frontend Docs

**Scenario:** You're working on a backend API and don't want any frontend docs.

```bash
# Discover backend docs
/discover-context --category=backend

# Review the list and select only what you need
/load-context --ids=1,2
```

Result: Only backend API docs loaded, no frontend clutter.

### Use Case 2: Focus on Specific Topic

**Scenario:** You need validation patterns across all categories.

```bash
# Find all validation-related docs
/discover-context validation

# Load only the most relevant ones
/load-context --ids=2,4
```

### Use Case 3: Feature-Specific Context

**Scenario:** Working on the "guests" feature.

```bash
# Find feature-specific docs
/discover-context --feature=guests

# Load all feature docs
/load-context feature guests
```

### Use Case 4: Token Budget Management

**Scenario:** You have a tight token budget (e.g., 5000 tokens max).

```bash
# Discover all backend docs
/discover-context --category=backend

# See total tokens: 3450
# Pick only essential docs to stay under budget
/load-context --ids=1,3,5
```

## Benefits

1. **Token Efficiency**: Load only what you need
2. **Reduced Clutter**: No irrelevant context
3. **Better Control**: See exactly what's available before loading
4. **Cost Savings**: Fewer tokens = lower costs
5. **Faster Context**: Less content to process

## Backward Compatibility

The old workflow still works:

```bash
# Still loads all backend docs
/load-context backend

# Still loads all frontend docs
/load-context frontend

# Still loads everything
/load-context both
```

But the new workflow gives you more control!

## Database Schema

Documents are stored in `context_documents` table:

```sql
CREATE TABLE context_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

## Adding Your Own Documentation

1. **Create markdown files** in appropriate directories:
   - `docs/backend/` - Backend architecture
   - `docs/frontend/` - Frontend patterns
   - `docs/features/FEATURE_NAME/` - Feature-specific
   - `docs/plans/` - Project plans

2. **Add frontmatter** to your docs:
   ```yaml
   ---
   title: My Backend Pattern
   category: backend
   tags: [api, validation, security]
   summary: How to validate API requests securely
   feature: user-auth  # optional
   ---
   ```

3. **Index the docs**:
   ```bash
   /index-docs
   ```

4. **Discover and load**:
   ```bash
   /discover-context validation
   /load-context --ids=5,6,7
   ```

## Tips

- Use **discover first** to see what's available
- Check **token estimates** before loading
- Use **category filters** to narrow down results
- Use **tag filters** for cross-cutting concerns
- Use **IDs** for precise control over what gets loaded
- **Re-index** after adding new documentation files

## Summary

The new selective context loading gives you full control over what documentation gets loaded into your conversation. Use it to:
- Save tokens
- Reduce context clutter
- Focus on relevant topics
- Stay within budget
- Work more efficiently

Happy context loading!
