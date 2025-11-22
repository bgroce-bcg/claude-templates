# CADI Helper Scripts

This directory contains helper scripts for common CADI operations. These scripts provide faster, token-free alternatives to agent-based operations.

## Available Scripts

### 1. `index-documentation.js` (Node.js)

Fast documentation indexer that scans markdown files and updates the `context_documents` table in the project database.

**Requirements:**
- Node.js
- `better-sqlite3` package

**Usage:**
```bash
node .claude/scripts/index-documentation.js
```

**What it does:**
- Scans all markdown files in `docs/` directory recursively
- Parses frontmatter (YAML between `---` markers)
- Extracts metadata: title, category, summary, tags
- Estimates token count for each document
- Updates database with new/modified files
- Removes orphaned entries (files deleted from filesystem)
- Shows detailed statistics and category breakdown

**Performance:**
- Typically 10-50x faster than agent-based indexing
- No Claude tokens consumed
- Can be run in CI/CD pipelines

---

### 2. `index-documentation.sh` (Bash)

Bash alternative to the Node.js indexer. Use this if Node.js is not available.

**Requirements:**
- Bash
- `sqlite3` CLI tool
- Standard Unix utilities (find, grep, sed, etc.)

**Usage:**
```bash
.claude/scripts/index-documentation.sh
```

**What it does:**
Same functionality as the Node.js version, but implemented in pure Bash.

**Performance:**
- Slower than Node.js version but still faster than agent-based
- No external dependencies beyond sqlite3

---

### 3. `query-documentation.sh` (Bash)

Query and retrieve indexed documentation from the database.

**Requirements:**
- Bash
- `sqlite3` CLI tool

**Usage:**
```bash
# List all documentation
.claude/scripts/query-documentation.sh --list-only

# Search for specific topic
.claude/scripts/query-documentation.sh "authentication" --list-only

# Filter by category
.claude/scripts/query-documentation.sh --category backend --list-only

# Load documentation content (not just list)
.claude/scripts/query-documentation.sh "API patterns"
```

**Options:**
- `--list-only`: Show only metadata (title, category, tokens)
- `--category <name>`: Filter by category (backend, frontend, feature, plan)
- `--tags <tags>`: Filter by tags (comma-separated)
- `--feature <name>`: Filter by feature name

**What it does:**
- Queries the `context_documents` table
- Supports filtering and full-text search
- Can list metadata or load full content
- Shows token estimates and file paths

---

## Integration with CADI Commands

These scripts are automatically used by CADI commands when available:

### `/index-docs` Command

The `/index-docs` command will:
1. First try to use `index-documentation.js` (if Node.js available)
2. Fall back to agent-based indexing if script unavailable
3. Report results either way

This means you get:
- **Fast indexing** when Node.js is available
- **Automatic fallback** when it's not
- **Consistent results** regardless of method

---

## Database Schema

These scripts interact with the `context_documents` table:

```sql
CREATE TABLE context_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT CHECK(category IN ('backend', 'frontend', 'feature', 'plan')),
    summary TEXT,
    tags TEXT,  -- JSON array stored as text
    feature_id INTEGER,
    estimated_tokens INTEGER,
    file_modified INTEGER,  -- Unix timestamp
    last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES features(id)
);
```

---

## Frontmatter Format

For best results, add frontmatter to your markdown documentation:

```markdown
---
title: Backend API Architecture
category: backend
tags: [api, rest, validation]
summary: RESTful API patterns and error handling strategies
feature: user-authentication
---

# Your Document Content...
```

**Supported fields:**
- `title`: Document title (falls back to filename)
- `category`: One of: backend, frontend, feature, plan (inferred from path if missing)
- `tags`: Array of tags for filtering
- `summary`: Brief description (extracted from first paragraph if missing)
- `feature`: Optional feature name to link this doc to a feature

---

## CI/CD Integration

These scripts can be run in automated workflows:

**Example GitHub Action:**
```yaml
- name: Index Documentation
  run: |
    if [ -f .claude/scripts/index-documentation.js ]; then
      npm install better-sqlite3
      node .claude/scripts/index-documentation.js
    fi
```

**Example Pre-commit Hook:**
```bash
#!/bin/bash
# Re-index docs before committing
if [ -f .claude/scripts/index-documentation.sh ]; then
  .claude/scripts/index-documentation.sh > /dev/null
fi
```

---

## Troubleshooting

### "better-sqlite3 not found" (Node.js script)

Install the dependency:
```bash
npm install better-sqlite3
# or
yarn add better-sqlite3
```

### "database is locked" error

The database is being accessed by another process. Wait and try again.

### Files not being indexed

Check:
1. Files are in `docs/` directory
2. Files have `.md` extension
3. Database file exists at `.claude/project.db`
4. You have write permissions

### Incorrect category detection

Add explicit frontmatter to your markdown files to specify the category.

---

## Maintenance

These scripts are part of the CADI template and are automatically updated when you push template updates from CADI Monitor.

**When scripts are updated:**
- Existing scripts in your project will be replaced
- Custom scripts you've added (not in template) will be preserved
- A backup is created before any update

---

## Performance Comparison

| Method | Time (100 docs) | Token Cost | Offline |
|--------|----------------|------------|---------|
| Node.js script | ~2 seconds | 0 | ✅ Yes |
| Bash script | ~8 seconds | 0 | ✅ Yes |
| Agent-based | ~45 seconds | ~500 tokens | ❌ No |

**Recommendation:** Use Node.js script when possible for best performance.
