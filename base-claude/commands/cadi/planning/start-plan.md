---
description: Start a new PLANNING document for a new feature
argument-hint: [feature to plan a new-feature]
---

# Start Plan
Execute the Workflow in order

## Variables
`FEATURE`: $ARGUMENTS

## Workflow
- If no `FEATURE`: ask for it
- If not primed: run `/prime-backend` then `/prime-frontend` (wait for each)
- Ask user for feature description
- Ask clarifying questions about logic/requirements (keep brief)
- Write concise PLANNING.md in docs/plans/`FEATURE` (create directories if needed)

## Planning Guidelines
**CRITICAL - Keep it minimal:**
- Summary: 2-3 sentences max
- Requirements: Only what's necessary to build, no fluff
- User Stories: Only if they clarify the feature
- Skip sections that don't add value
- Focus on WHAT to build, not HOW (that's for implementation)

## Format
```
# PLANNING

## Summary
{2-3 sentence description of what this feature does and why}

## Requirements
- {Bullet list of specific, concrete requirements}
- {Focus on functionality, not implementation details}
- {Include error states only if non-obvious}

## UI / UX (if applicable)
- {Key user interactions}
- {Navigation changes}

## Notes
- {Dependencies on other features/systems}
- {Any constraints or considerations}
```

**Keep it minimal.** Include only what's needed to understand and build the feature.
