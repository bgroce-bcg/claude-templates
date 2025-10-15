# Workflow Chains

This document shows how agents and commands work together in your Claude templates.

## Core Development Workflows

### Quick Feature Workflow (Simple Features)

**Use for:** Single components, utilities, bug fixes, simple endpoints

```
/quick-feature [description]
    ↓
quick-feature-builder agent
    ├─→ /prime-backend
    ├─→ /prime-frontend
    ├─→ Implement feature
    ├─→ component-builder agent (if UI needed)
    ├─→ test-builder agent (generate tests)
    ├─→ /lint --fix
    ├─→ /test
    └─→ code-reviewer agent
    ↓
/commit (optional)
```

### Full Planning Workflow (Complex Features)

**Use for:** Multi-section features, architectural changes, complex integrations

```
/start-plan [feature]
    ↓
/create-plan [feature]
    ↓
/build [feature]
    ↓ (for each section)
    ├─→ plan-section-builder agent
    │   ├─→ /prime-backend
    │   ├─→ /prime-frontend
    │   ├─→ component-builder agent (if UI components needed)
    │   ├─→ test-builder agent (if tests needed)
    │   ├─→ /lint --fix
    │   ├─→ /test
    │   └─→ code-reviewer agent
    ↓
    ├─→ /commit (optional, after each section)
    ↓
/complete-plan [feature]
    ├─→ /test (full suite)
    ├─→ /lint
    ├─→ code-reviewer agent (all changes)
    └─→ /commit (optional, final commit)
```

## Quality Assurance Chain

**Automatic (built into plan-section-builder):**
```
Implementation
    ↓
/lint --fix (auto-fix issues)
    ↓
/test (verify functionality)
    ↓
code-reviewer agent (check quality)
    ↓
Mark section complete
```

## Commit Workflow Chain

**When using /commit:**
```
/commit [optional message]
    ↓
/lint --fix (ensure clean code)
    ↓
/test (ensure nothing broken)
    ↓
Generate conventional commit message
    ↓
Create commit
```

## Component Creation Chain

**For React/Next.js components:**
```
plan-section-builder agent
    ↓ (detects UI component needed)
component-builder agent
    ├─→ Reads docs/frontend/
    ├─→ Creates TypeScript component
    ├─→ Adds proper styling
    └─→ Includes accessibility
```

## Test Generation Chain

**For creating tests:**
```
Implementation complete
    ↓
test-builder agent
    ├─→ Analyzes target code
    ├─→ Generates test cases (happy path, edge cases, errors)
    ├─→ Creates mocks/fixtures
    └─→ Writes test file
    ↓
/test (verify tests pass)
```

## Git Operations Chain

**Complex git operations:**
```
git-helper agent
    ├─→ Check git status
    ├─→ Perform operation (merge, rebase, etc.)
    ├─→ Handle conflicts if needed
    └─→ Verify final state
```

## Refactoring Chain

**For code improvements:**
```
refactor-advisor agent
    ├─→ Scan target code
    ├─→ Identify issues and smells
    ├─→ Suggest improvements
    └─→ Prioritize by impact
    ↓
Implement changes
    ↓
/test (ensure nothing broken)
    ↓
code-reviewer agent (verify improvements)
    ↓
/commit
```

## Key Integration Points

### quick-feature-builder uses:
- `/prime-backend` - Load backend context
- `/prime-frontend` - Load frontend context
- `component-builder` - Create React components
- `test-builder` - Generate tests
- `/lint --fix` - Fix code quality
- `/test` - Verify implementation
- `code-reviewer` - Review changes

### plan-section-builder uses:
- `/prime-backend` - Load backend context
- `/prime-frontend` - Load frontend context
- `component-builder` - Create React components
- `test-builder` - Generate tests
- `/lint --fix` - Fix code quality
- `/test` - Verify implementation
- `code-reviewer` - Review changes

### /quick-feature uses:
- `quick-feature-builder` - Complete implementation
- `/commit` - Optional commit after completion

### /build uses:
- `plan-section-builder` - Build each section
- `/commit` - Optional commits per section
- `/complete-plan` - Finalize feature

### /commit uses:
- `/lint --fix` - Pre-commit cleanup
- `/test` - Pre-commit verification

### /complete-plan uses:
- `/test` - Final test run
- `/lint` - Final quality check
- `code-reviewer` - Final review
- `/commit` - Optional final commit

## Framework-Specific Chains

### Laravel Projects
```
plan-section-builder
    ↓ (for API endpoints)
laravel-architect agent
    ↓
api-builder agent
    ├─→ Create routes
    ├─→ Create controllers
    ├─→ Create Form Requests
    └─→ Create Resources
    ↓
/test-laravel (Laravel-specific testing)
```

### Next.js Projects
```
plan-section-builder
    ↓ (for UI features)
next-architect agent
    ↓
component-builder agent
    ├─→ Server vs Client decision
    ├─→ Create component
    └─→ Add styling
    ↓
react-server-components agent (if RSC patterns needed)
```

## Benefits of These Chains

1. **Consistency**: Every section goes through same quality checks
2. **Automation**: Quality checks happen automatically, not manually
3. **Predictability**: Clear workflow reduces decision fatigue
4. **Quality**: Multiple verification points catch issues early
5. **Documentation**: Changes automatically documented in feature README
6. **Testability**: Tests generated and run automatically
7. **Standards**: Linting and code review enforce standards

## Customization

You can modify these chains by editing:
- `base-claude/agents/plan-section-builder.md` - Core section workflow
- `base-claude/commands/build.md` - Multi-section workflow
- `base-claude/commands/commit.md` - Commit workflow
- `base-claude/commands/complete-plan.md` - Completion workflow
