## Variables

- `$CATEGORY`: Optional category to index (e.g., `/index-docs backend`)
- If not provided, indexes all documentation

## Workflow

Use the `context-loader` agent to scan and index all project documentation:

1. **Determine scope**:
   - If `$CATEGORY` provided: Index only that category (backend, frontend, feature, or plan)
   - If not provided: Index all categories

2. **Call context-loader agent**:
   - Provide **request**: "index all documentation"
   - If `$CATEGORY` provided, set **category** to `$CATEGORY`
   - Set **list_only**: true (just index, don't return content)

3. **Report results**:
   - Show how many docs were indexed/updated/removed
   - Display index statistics (docs per category)
   - Confirm index is up to date

## Purpose

This command is a convenience wrapper around the context-loader agent. It forces a full re-index of documentation, which is useful:
- After adding new documentation files
- After modifying existing docs
- When setting up a new project
- To verify index is synchronized with filesystem

## Example Usage

```bash
# Index all documentation
/index-docs

# Index only backend docs
/index-docs backend

# Index only frontend docs
/index-docs frontend
```
