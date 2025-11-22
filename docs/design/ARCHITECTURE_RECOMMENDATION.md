# CADI Architecture Analysis: Docker vs Per-Project Installation

## Executive Summary

**Recommendation: Keep the current per-project installation model.** The distributed architecture aligns well with Claude Code's design philosophy and provides better flexibility, performance, and user experience. However, consider containerizing **only** the `cadi-monitor` component for easier deployment and cross-project visibility.

## Current Architecture Analysis

### How It Works Today

1. **Installation Model**: `init-claude-project.sh` copies `.claude/` directory into each project
   - Contains: agents, commands, scripts, hooks, settings.json
   - Creates: `project.db` SQLite database per project
   - Location: `.claude/project.db` (project-specific)

2. **Slash Commands**: Markdown files in `.claude/commands/` that Claude Code reads directly
   - Claude Code discovers commands by scanning the directory
   - Commands execute via `sqlite3` CLI tool to query/modify `project.db`
   - Examples: `/plan`, `/load-context`, `/plan-status`

3. **Agents**: Markdown files in `.claude/agents/` invoked by Claude Code
   - Execute SQL queries using `sqlite3 .claude/project.db`
   - All state coordination happens via database (enables parallel execution)
   - Examples: `plan-section-builder`, `context-loader`

4. **CADI Monitor**: Separate Node.js service that:
   - Reads multiple `project.db` files (read-only)
   - Watches file changes across projects
   - Provides web UI at `http://localhost:3030`
   - Currently runs as standalone process

### Key Characteristics

- **File-based**: All commands/agents are markdown files Claude Code reads natively
- **Project-scoped**: Each project has isolated database and context
- **Stateless agents**: Parallel execution via database coordination
- **Read-only monitoring**: cadi-monitor never modifies projects

## Docker Containerization Analysis

### Option 1: Full Dockerization (All Components)

**How it would work:**
- Single Docker container with:
  - CADI commands/agents installed
  - API server exposing commands via HTTP
  - Centralized database (one `project.db` per project)
  - All projects mount volumes or connect via API

**Pros:**
- ✅ Single deployment point
- ✅ Version control easier
- ✅ Could share context across projects (if desired)
- ✅ Easier updates (one container to update)

**Cons:**
- ❌ **Breaks Claude Code integration**: Claude Code expects commands/agents in `.claude/` directory
- ❌ **Performance overhead**: HTTP calls for every command execution
- ❌ **Complexity**: Need API layer, authentication, routing
- ❌ **Locks**: Multiple projects couldn't write to same DB simultaneously
- ❌ **File system access**: Commands need to read/write project files
- ❌ **Context isolation**: Projects might interfere with each other
- ❌ **Network dependency**: Requires Docker/runtime to be running

**Verdict: ❌ Not recommended** - Would fundamentally change how Claude Code works

### Option 2: Hybrid (Monitor Only)

**How it would work:**
- Keep per-project installation as-is
- Dockerize only `cadi-monitor`:
  - Mount project directories as volumes
  - Read `project.db` files from mounted paths
  - Provides web UI for cross-project monitoring

**Pros:**
- ✅ **Preserves Claude Code integration**: Commands/agents stay in `.claude/`
- ✅ **Easy deployment**: One command to start monitoring
- ✅ **Cross-platform**: Works regardless of OS
- ✅ **Portability**: Can run monitor anywhere
- ✅ **Team sharing**: Multiple users can access same monitor
- ✅ **No changes needed**: Doesn't affect existing workflow

**Cons:**
- ⚠️ **Volume mounting**: Need to configure project paths
- ⚠️ **Permissions**: Docker needs read access to project directories

**Verdict: ✅ Recommended** - Best of both worlds

### Option 3: Current Architecture (No Docker)

**Pros:**
- ✅ **Native Claude Code integration**: Commands work directly
- ✅ **Zero latency**: Direct file system access
- ✅ **Simple**: No containers, volumes, or networking
- ✅ **Isolated**: Each project completely independent
- ✅ **Stateless**: Can run commands anywhere
- ✅ **Version control friendly**: `.claude/` can be gitignored or committed
- ✅ **Offline capable**: Works without network

**Cons:**
- ⚠️ **Update complexity**: Must update each project separately
- ⚠️ **Monitor setup**: Requires npm install and configuration per user

**Verdict: ✅ Recommended** - Current approach is solid

## Detailed Comparison

### Performance

| Aspect | Per-Project | Docker (Full) | Docker (Monitor Only) |
|--------|-------------|---------------|------------------------|
| Command execution | <1ms (direct) | 10-50ms (HTTP) | <1ms (direct) |
| Database queries | <5ms (local SQLite) | 10-50ms (network) | <5ms (local SQLite) |
| File system access | Native | Requires volume mounts | Native |
| Startup time | Instant | Container startup | Container startup |

### User Experience

| Aspect | Per-Project | Docker (Full) | Docker (Monitor Only) |
|--------|-------------|---------------|------------------------|
| Setup complexity | Low (run script) | High (Docker + config) | Medium (Docker + volumes) |
| Claude Code integration | Native | Broken | Native |
| Multi-project monitoring | Manual | Centralized | Centralized |
| Offline capability | Yes | Partial | Yes |
| Cross-platform | Yes | Yes | Yes |

### Maintenance

| Aspect | Per-Project | Docker (Full) | Docker (Monitor Only) |
|--------|-------------|---------------|------------------------|
| Updates | Per-project script | Single container | Single container |
| Version control | Per-project | Centralized | Centralized |
| Debugging | Direct file access | Container logs | Container logs |
| Backup | Standard git/fs | Container volumes | Standard git/fs |

## Specific Considerations

### 1. Claude Code Integration

**Critical**: Claude Code reads commands/agents from `.claude/` directory in the project root. This is a native feature that works seamlessly with the current architecture.

**If Dockerized**: Would need to:
- Either mount `.claude/` as volume (defeats purpose)
- Or create API layer (breaks native integration)
- Or modify Claude Code itself (not feasible)

**Recommendation**: Keep commands/agents in project directories.

### 2. Database Isolation

**Current**: Each project has isolated `project.db`:
- ✅ No conflicts between projects
- ✅ Can work on multiple projects simultaneously
- ✅ Safe to commit/backup independently
- ✅ Fast (local SQLite)

**If Centralized**: Would need:
- Multi-tenant database design
- Concurrency control
- Project isolation logic
- Network overhead

**Recommendation**: Keep per-project databases.

### 3. Parallel Execution

**Current**: Multiple agents can run simultaneously, coordinating via database:
- Agents query `sections.status` and `sections.depends_on`
- Database acts as coordination mechanism
- No locking conflicts (different sections)

**If Dockerized**: Would need:
- API rate limiting
- Request queuing
- Session management
- Still need database for coordination

**Recommendation**: Current approach scales better.

### 4. CADI Monitor

**Current**: Standalone Node.js app:
- Reads from multiple `project.db` files
- Watches file system changes
- Provides REST API + WebSocket

**If Dockerized**: Benefits:
- ✅ Easy deployment (`docker run`)
- ✅ Consistent environment
- ✅ Can share with team
- ✅ Port forwarding for remote access

**Recommendation**: Dockerize monitor only.

## Final Recommendations

### Primary Recommendation: Hybrid Approach

**Keep per-project installation** for commands/agents:
- Maintains native Claude Code integration
- Preserves performance and simplicity
- Allows project-specific customization

**Dockerize cadi-monitor**:
- Easy deployment and sharing
- Consistent runtime environment
- Team-accessible monitoring

### Implementation Plan

#### Step 1: Create Dockerfile for CADI Monitor

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY packages/cadi-monitor/package*.json ./
RUN npm ci --production

# Copy application files
COPY packages/cadi-monitor/ ./

# Expose port
EXPOSE 3030

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3030/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run monitor
CMD ["node", "src/server.js"]
```

#### Step 2: Docker Compose Configuration

```yaml
version: '3.8'

services:
  cadi-monitor:
    build:
      context: .
      dockerfile: packages/cadi-monitor/Dockerfile
    ports:
      - "3030:3030"
    volumes:
      # Mount project directories
      - ~/projects:/projects:ro
      # Persistent config
      - cadi-monitor-config:/root/.cadi-monitor
    environment:
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  cadi-monitor-config:
```

#### Step 3: Usage Guide

```bash
# Build and run
docker-compose up -d

# Or run directly
docker run -d \
  -p 3030:3030 \
  -v ~/projects:/projects:ro \
  -v cadi-monitor-config:/root/.cadi-monitor \
  cadi-monitor

# Configure projects
docker exec -it cadi-monitor cadi-monitor add /projects/my-app "My App"
```

### Alternative: Keep Current Architecture

If Docker adds complexity without sufficient benefit, **keeping the current architecture is perfectly valid**:

**Benefits:**
- Already works excellently
- Zero configuration overhead
- Native performance
- Simple debugging

**For team sharing**: Use `npm link` or global install:
```bash
cd packages/cadi-monitor
npm link
cadi-monitor start --host 0.0.0.0  # Team accessible
```

## Migration Path (If Needed)

If you decide to Dockerize monitor later:

1. **Phase 1**: Create Dockerfile for monitor (no changes to core)
2. **Phase 2**: Test with existing projects
3. **Phase 3**: Document Docker usage
4. **Phase 4**: (Optional) Add docker-compose for convenience

**No breaking changes** - per-project installation remains untouched.

## Conclusion

**Recommended Architecture:**
- ✅ **Keep per-project installation** for commands/agents/database
- ✅ **Dockerize cadi-monitor** for easy deployment and sharing
- ✅ **Maintain current workflow** for Claude Code integration

This hybrid approach gives you:
- Native Claude Code performance and integration
- Easy monitoring deployment and sharing
- Best of both worlds

The current per-project model is actually a **strength**, not a weakness - it's perfectly aligned with how Claude Code works and provides excellent isolation and performance.


