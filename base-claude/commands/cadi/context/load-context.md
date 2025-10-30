---
name: load-context
description: Load project context from database (backend, frontend, or feature-specific)
---

# Load Context Command

Loads project documentation from the database using the context-loader agent.

## Usage

```bash
/load-context [context-type] [feature-name]
/load-context --ids=<comma-separated-ids>
```

**Arguments:**
- `context-type` (optional): "backend", "frontend", "both", or "feature". Default: "both"
- `feature-name` (optional): Name of feature to load feature-specific docs. Required if context-type is "feature"
- `--ids=<value>`: Load specific documents by ID (comma-separated, e.g., "1,2,5")

## Examples

```bash
# Load both backend and frontend context
/load-context

# Load only backend context
/load-context backend

# Load only frontend context
/load-context frontend

# Load feature-specific context
/load-context feature user-auth

# Load specific documents by ID (use after /discover-context)
/load-context --ids=1,2,5
```

## Workflow

1. **Parse arguments**:
   - Check for `--ids=` flag first
   - If --ids present: extract comma-separated document IDs
   - Otherwise:
     - If no args: set context_type = "both"
     - If first arg: set context_type = arg
     - If second arg: set feature_name = arg

2. **Validate arguments**:
   - If --ids provided: validate IDs are numeric
   - If context_type = "feature" and no feature_name: ask user for feature name
   - Valid context types: backend, frontend, both, feature

3. **Load context based on type**:

   **If --ids provided:**
   ```bash
   # Launch context-loader agent with specific document IDs
   context-loader request="load specific documents" ids="1,2,5" list_only="false"
   ```

   **If context_type = "backend":**
   ```bash
   # Launch context-loader agent with backend filter
   context-loader request="backend architecture and patterns" category="backend" list_only="false"
   ```

   **If context_type = "frontend":**
   ```bash
   # Launch context-loader agent with frontend filter
   context-loader request="frontend architecture and patterns" category="frontend" list_only="false"
   ```

   **If context_type = "both":**
   ```bash
   # Launch context-loader agent for backend
   context-loader request="backend architecture and patterns" category="backend" list_only="false"

   # Then launch context-loader agent for frontend
   context-loader request="frontend architecture and patterns" category="frontend" list_only="false"
   ```

   **If context_type = "feature":**
   ```bash
   # Launch context-loader agent with feature filter
   context-loader request="feature documentation" feature="FEATURE_NAME" list_only="false"
   ```

4. **Report results**:
   - Show number of documents loaded
   - Show total estimated tokens
   - Confirm context is ready for use

## Notes

- This command replaces `/prime-backend` and `/prime-frontend` with database-driven context loading
- Context is automatically indexed from `docs/backend/`, `docs/frontend/`, and `docs/features/` directories
- Use `/index-docs` if you need to manually trigger documentation indexing
- Token estimates help you understand context size before loading
- Use `/discover-context` first to see available documents and their IDs before loading

## Recommended Workflow

1. **Discover available docs**: `/discover-context api --category=backend`
2. **Review the list**: See document IDs, titles, summaries, and token estimates
3. **Load specific docs**: `/load-context --ids=1,2,5`

This two-step approach gives you full control over what context gets loaded.
