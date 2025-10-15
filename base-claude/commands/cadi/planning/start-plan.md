---
description: Start a new PLANNING document for a new feature
argument-hint: [feature to plan a new-feature]
---

# Start Plan
Execute the Workflow in order

## Variables
`FEATURE`: $ARGUMENTS

## Workflow
- If no `FEATURE` is provided, stop immediately and ask the user to give a feature name.
- Learning: If not currently primed, run commands /prime-backend and /prime-frontend. Wait for the completion of priming before continuing.
- Ask the user for a description of the of the feature that they want to build. Wait for input.
- think harder about what the user is trying to do with this feature.
- If you have clarifying questions that would determine the logic of the feature, then ask the user those questions. Don't ask the user too many questions at one time, try to figure out what the user wants.
- Think harder about the answers the user giveswrite a PLANNING.md document in the output format listed under the `Format` section. This document should be created in docs/plans/`FEATURE`. You will need to create the needed directories.

## Format
The PLANNING.md should be structured in this way:
```
# PLANNING

## Summary
- Brief description of the feature.
- Problem it solves or user need it addresses.
- Key goals or success criteria.

## Context
- Relevant backend, frontend, or business context.
- Dependencies on other features or systems.

## User Stories
- Clear user stories (e.g., As a user, I want to… so that…)
- Any important user flows or scenarios.

## Requirements
- Functional requirements: specific behaviors, inputs/outputs, rules.
- Non-functional requirements: performance, security, accessibility, scalability, etc.
- Error states and fallback behaviors.

## UI / UX Details
- Descriptions of key interactions.
- Navigation changes if applicable
```
