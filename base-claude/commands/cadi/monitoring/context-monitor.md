---
name: context-monitor
description: Monitor context loading activity by agents
---

# Context Monitor Command

View what context has been loaded by agents during their work.

## Usage

```bash
/context-monitor [filter]
```

**Arguments:**
- `filter` (optional): "recent", "feature FEATURE_NAME", "agent AGENT_NAME", "section SECTION_ID", or "all". Default: "recent"

## Examples

```bash
# View recent context loads (last 10)
/context-monitor
/context-monitor recent

# View all context loads
/context-monitor all

# View context loads for a specific feature
/context-monitor feature user-auth

# View context loads by a specific agent
/context-monitor agent plan-section-builder

# View context loads for a specific section
/context-monitor section 5
```

## Workflow

**CRITICAL: Use CADI Project Database**
All database operations MUST use the CADI project database located at `.claude/project.db`.

### Step 1: Parse Filter

Parse the filter argument:
- No argument or "recent": Show last 10 loads
- "all": Show all loads
- "feature FEATURE_NAME": Filter by feature name
- "agent AGENT_NAME": Filter by agent name
- "section SECTION_ID": Filter by section ID

### Step 2: Query Database

**For recent loads:**
```sql
SELECT
  cl.id,
  cl.timestamp,
  cl.agent_name,
  cl.request,
  cl.category,
  cl.document_count,
  cl.total_tokens,
  cl.duration_ms,
  f.name as feature_name,
  s.name as section_name
FROM context_loads cl
LEFT JOIN features f ON cl.feature_id = f.id
LEFT JOIN sections s ON cl.section_id = s.id
ORDER BY cl.timestamp DESC
LIMIT 10;
```

**For feature filter:**
```sql
SELECT
  cl.id,
  cl.timestamp,
  cl.agent_name,
  cl.request,
  cl.category,
  cl.document_count,
  cl.total_tokens,
  cl.duration_ms,
  s.name as section_name
FROM context_loads cl
LEFT JOIN sections s ON cl.section_id = s.id
LEFT JOIN features f ON cl.feature_id = f.id
WHERE f.name = ?
ORDER BY cl.timestamp DESC;
```

**For agent filter:**
```sql
SELECT
  cl.id,
  cl.timestamp,
  cl.agent_name,
  cl.request,
  cl.category,
  cl.document_count,
  cl.total_tokens,
  cl.duration_ms,
  f.name as feature_name,
  s.name as section_name
FROM context_loads cl
LEFT JOIN features f ON cl.feature_id = f.id
LEFT JOIN sections s ON cl.section_id = s.id
WHERE cl.agent_name = ?
ORDER BY cl.timestamp DESC;
```

**For section filter:**
```sql
SELECT
  cl.id,
  cl.timestamp,
  cl.agent_name,
  cl.request,
  cl.category,
  cl.document_count,
  cl.total_tokens,
  cl.duration_ms,
  f.name as feature_name,
  s.name as section_name
FROM context_loads cl
LEFT JOIN features f ON cl.feature_id = f.id
LEFT JOIN sections s ON cl.section_id = s.id
WHERE cl.section_id = ?
ORDER BY cl.timestamp DESC;
```

**For all loads:**
```sql
SELECT
  cl.id,
  cl.timestamp,
  cl.agent_name,
  cl.request,
  cl.category,
  cl.document_count,
  cl.total_tokens,
  cl.duration_ms,
  f.name as feature_name,
  s.name as section_name
FROM context_loads cl
LEFT JOIN features f ON cl.feature_id = f.id
LEFT JOIN sections s ON cl.section_id = s.id
ORDER BY cl.timestamp DESC;
```

### Step 3: Display Results

Format and display the results:

```
## Context Loading Activity

**Filter:** {filter description}
**Total loads:** {count}

### Context Loads

{for each load:}

**Load #{id}** - {timestamp}
- **Agent:** {agent_name}
- **Request:** {request}
- **Category:** {category}
- **Feature:** {feature_name or "N/A"}
- **Section:** {section_name or "N/A"}
- **Documents:** {document_count} documents
- **Tokens:** {total_tokens} tokens
- **Duration:** {duration_ms}ms

---

{end for}

### Summary Statistics

- **Total context loads:** {count}
- **Total documents loaded:** {sum of document_count}
- **Total tokens loaded:** {sum of total_tokens}
- **Average documents per load:** {avg document_count}
- **Average tokens per load:** {avg total_tokens}
- **Average duration:** {avg duration_ms}ms
```

### Step 4: View Document Details (Optional)

If user wants to see which specific documents were loaded, query the document IDs:

```sql
SELECT document_ids FROM context_loads WHERE id = ?;
```

Then for each document ID in the JSON array:
```sql
SELECT id, title, file_path, category, estimated_tokens
FROM context_documents
WHERE id IN ({document_ids});
```

Display:
```
### Documents Loaded in Load #{id}

| ID | Title                    | Category | Path                        | Tokens |
|----|--------------------------|----------|-----------------------------|--------|
| 1  | Backend API Architecture | backend  | docs/backend/api.md         | 1200   |
| 2  | Auth Patterns           | backend  | docs/backend/auth.md        | 800    |
```

## Edge Cases

**No context loads found:**
- Report: "No context loads found for this filter"
- Suggest checking if context-loader agent has been used

**Database doesn't exist:**
- Report error and suggest running `/db-init`

**Invalid filter:**
- Report error and show valid filter options
- Example: "recent", "all", "feature FEATURE_NAME", "agent AGENT_NAME", "section SECTION_ID"

**Feature/section not found:**
- Report: "Feature/section not found: {name}"
- List available features/sections

## Performance Monitoring

Use this command to:
- **Monitor token usage**: See how much context agents are loading
- **Identify heavy loads**: Find agents loading too much context
- **Track performance**: See which context loads are slow (high duration_ms)
- **Debug issues**: Understand what context an agent had when it worked

## Notes

- Context loads are only tracked when `list_only=false` in context-loader agent
- `list_only=true` queries are not logged (they don't load full content)
- Document IDs are stored as JSON array strings for later reference
- Duration tracking helps identify performance bottlenecks in context loading
