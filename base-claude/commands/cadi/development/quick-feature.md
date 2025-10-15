---
description: Quickly build a simple feature with testing and quality checks
argument-hint: [feature description]
---

# Quick Feature

Build a simple feature end-to-end with automatic testing and code review, without the overhead of multi-section planning.

## When to Use

**Use /quick-feature for:**
- Simple UI components or forms
- Single endpoint API additions
- Bug fixes that need tests
- Small utility functions or helpers
- Filter/search implementations
- Simple CRUD operations

**Use full CADI planning for:**
- Multi-page features
- Complex workflows with dependencies
- Architectural changes
- Features requiring staged rollout
- Integration with multiple systems

## Variables

**FEATURE_DESCRIPTION**: $ARGUMENTS

## Workflow

### Step 1: Validate Input
- If no FEATURE_DESCRIPTION provided, ask user for feature description
- Feature description should be concise (1-3 sentences)

### Step 2: Launch Quick Feature Builder
Use `quick-feature-builder` agent with:
- **feature_description**: The feature to build
- **context_hint**: Optional hint about which parts of codebase are relevant

### Step 3: Report Completion
Agent will report:
- Files created/modified
- Tests added
- Code review findings
- Any follow-up needed