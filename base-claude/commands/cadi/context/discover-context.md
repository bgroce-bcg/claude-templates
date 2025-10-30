---
name: discover-context
description: Discover available documentation topics before loading (list metadata only)
---

# Discover Context Command

Shows available project documentation with descriptions, allowing you to browse before loading.

## Usage

```bash
/discover-context [search-term] [options]
```

**Arguments:**
- `search-term` (optional): Free-text search (e.g., "api", "validation", "authentication")
- `--category=<value>`: Filter by category (backend, frontend, feature, plan)
- `--tags=<value>`: Filter by comma-separated tags (e.g., "api,validation")
- `--feature=<value>`: Filter by feature name

## Examples

```bash
# Discover all available docs
/discover-context

# Find API-related docs
/discover-context api

# Find backend docs only
/discover-context --category=backend

# Find docs tagged with api and validation
/discover-context --tags=api,validation

# Find feature-specific docs
/discover-context --feature=guests

# Combined filters
/discover-context authentication --category=backend --tags=api
```

## Workflow

1. **Parse arguments**:
   - Extract search term (first non-flag argument)
   - Extract flags: --category, --tags, --feature
   - Default search term: "all documentation"

2. **Launch context-loader with list_only=true**:
   ```bash
   context-loader request="SEARCH_TERM" category="CATEGORY" tags="TAGS" feature="FEATURE" list_only="true"
   ```

3. **Display results**:
   The agent will return a formatted table like:
   ```
   Found 5 matching documents:

   | ID | Title                    | Category | Tags           | Tokens | Summary                        |
   |----|--------------------------|----------|----------------|--------|--------------------------------|
   | 1  | Backend API Architecture | backend  | api,rest       | 1200   | RESTful API patterns...        |
   | 2  | API Validation Patterns  | backend  | api,validation | 800    | Input validation strategies... |
   | 3  | Guest Management API     | feature  | api,guests     | 950    | Guest CRUD operations...       |

   Total estimated tokens: 2950
   ```

4. **Prompt for loading**:
   After displaying results, inform the user:
   ```
   To load specific documents, use:
   /load-context --ids=1,2,3

   Or load all matched documents:
   /load-context --category=backend
   ```

## Notes

- This command does NOT load document contents (only metadata)
- Use this to explore available docs before committing tokens to context
- Document IDs can be used with `/load-context --ids=<comma-separated-ids>` to load specific docs
- Token estimates help you plan your context budget
- Combine multiple filters to narrow down results

## See Also

- `/load-context` - Load full document contents
- `/index-docs` - Re-index documentation files
