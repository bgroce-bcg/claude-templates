# Quick Feature Guide

A simple, lightweight alternative to CADI's full planning workflow for straightforward features.

## The Problem

CADI's full planning system is powerful but sometimes overkill:
- Requires creating PLANNING.md
- Database setup with `/db-init`
- Breaking features into sections
- Running 4+ commands per feature

For simple features (a button, filter, API endpoint), this is too much overhead.

## The Solution: `/quick-feature`

One command that implements, tests, and reviews your feature - without the planning ceremony.

## When to Use What

### Use `/quick-feature` for:

**Simple UI Components**
```bash
/quick-feature "Add a date range picker to the events filter"
/quick-feature "Create a user avatar component with fallback initials"
/quick-feature "Add a loading skeleton for the product grid"
```

**Single API Endpoints**
```bash
/quick-feature "Add GET /api/users/:id/settings endpoint"
/quick-feature "Create POST /api/events/:id/rsvp endpoint with validation"
```

**Bug Fixes**
```bash
/quick-feature "Fix timezone conversion bug in event display and add tests"
/quick-feature "Resolve null pointer in user profile when email is missing"
```

**Utilities & Helpers**
```bash
/quick-feature "Create formatPhoneNumber helper for US/international numbers"
/quick-feature "Add debounce hook for search inputs"
```

**Simple CRUD**
```bash
/quick-feature "Add delete functionality to comments with confirmation modal"
```

### Use Full CADI Planning for:

**Multi-Page Features**
```bash
/start-plan payment-system
# Multiple pages: cart, checkout, confirmation
# Multiple sections: payment gateway, order processing, email notifications
```

**Complex Workflows**
```bash
/start-plan booking-system
# Interdependent sections
# Multi-step processes
# State management across pages
```

**Architectural Changes**
```bash
/start-plan migrate-to-graphql
# Affects multiple systems
# Requires staged implementation
# Needs dependency tracking
```

**Multi-System Integration**
```bash
/start-plan analytics-integration
# Backend API changes
# Frontend tracking
# Database schema updates
# Third-party service integration
```

## Quick Feature Workflow

```
/quick-feature "Add export to CSV button"
  ↓
  1. Load context (backend/frontend)
  2. Implement feature
  3. Generate tests
  4. Run lint --fix
  5. Run tests
  6. Code review
  7. Report completion
```

## What You Still Get

Even though it's "quick", you still get:
- Context-aware implementation
- Automatic test generation
- Code quality checks (linting)
- Test execution
- Code review
- Detailed completion report

## Examples with Expected Output

### Example 1: UI Component
```bash
/quick-feature "Add a user status badge component (online/offline/away)"
```

**What happens:**
1. Loads frontend patterns
2. Checks for similar badge components to reuse
3. Creates StatusBadge component with TypeScript
4. Generates component tests
5. Runs lint/test
6. Reviews code for accessibility
7. Reports: files created, tests added, review findings

### Example 2: API Endpoint
```bash
/quick-feature "Create GET /api/dashboard/stats endpoint returning user activity summary"
```

**What happens:**
1. Loads backend patterns
2. Creates route, controller method
3. Adds validation and error handling
4. Generates unit tests for endpoint
5. Runs tests
6. Reviews for security/performance
7. Reports completion

### Example 3: Bug Fix
```bash
/quick-feature "Fix the date formatting bug in event cards - dates showing wrong timezone"
```

**What happens:**
1. Identifies affected code
2. Fixes timezone conversion
3. Adds regression tests
4. Verifies fix with tests
5. Reviews for edge cases
6. Reports changes and test coverage

## Comparison

| Feature | Quick Feature | Full CADI |
|---------|---------------|-----------|
| Setup | None | PLANNING.md + database |
| Commands | 1 | 4+ (start-plan, create-plan, build, complete-plan) |
| Sections | No sections | Multi-section tracking |
| Dependencies | N/A | Dependency resolution |
| Database | Not needed | Required |
| Tests | Auto-generated | Auto-generated |
| Code Review | Included | Included |
| Best For | 1-file or simple changes | Multi-file, complex features |
| Time | 5-10 min | 30-60+ min |

## Graduating from Quick to Full

Sometimes a "quick" feature grows complex mid-implementation. The `quick-feature-builder` agent will tell you:

```
⚠️ This feature is more complex than expected.
Recommend using /start-plan instead:
- Requires 5+ files across frontend/backend
- Has dependencies between components
- Needs staged implementation
```

When this happens:
1. Note what's been done so far
2. Run `/start-plan feature-name`
3. Create proper PLANNING.md
4. Continue with `/create-plan` and `/build`

## Tips

1. **Be specific in your description**
   - Good: "Add a date range filter to events page using react-datepicker"
   - Vague: "Add filtering"

2. **One feature at a time**
   - Don't: "Add filters, sorting, and pagination"
   - Do: Use quick-feature for each, or use full planning

3. **Check the report**
   - Review files created/modified
   - Check test coverage
   - Address code review suggestions

4. **Commit after completion**
   - Quick feature completes with tested code
   - Run `/commit` to save your work

## Integration with Existing Workflow

Quick feature works alongside CADI:

```bash
# Working on a complex planned feature
/build payment-system

# Quick fix comes in
/quick-feature "Fix typo in payment confirmation email"

# Back to planned work
/build payment-system
```

Both systems:
- Use same agents (component-builder, test-builder, code-reviewer)
- Follow same quality standards
- Share context priming (/prime-backend, /prime-frontend)
- Work with same `/commit` workflow

## Summary

**Quick Feature = CADI Quality - Planning Overhead**

Perfect for the 80% of features that don't need multi-section orchestration.
