---
decription: Create a planning step document
argument-hint: [feature to plan]
---

# Create Plan
Take in `Variables`, Follow the `Workflow` and `Report` back to the user.

## Variables
FEATURE: $ARGUMENTS
PATH_TO_PLAN: docs/plans/`FEATURE`

## Instructions
- IMPORTANT: It is ok to have 1 section if the feature is small enough.
- Don't overcomlicate the plan with more sections if it is not necessary.

## Workflow

- If no `PATH_TO_PLAN` is provided, STOP immediately and ask the user to provide it.
- Look for `PATH_TO_PLAN`/PLANNING.md If it does not exist, stop immediately and ask the user to create PLANNING.md at the `PATH_TO_PLAN`
- Read PLANNING.md and Think hard about how to break the plan into smaller "Plan Sections" that can can be built and verified. Sections must be small precise executable sctions of the overall plan.
    *Plan Section*
    `
    ## Overview
    A brief overview of the plan section

    ## Objectives
    [ ] Build data structure (example)
    [ ] Create Intake Form (example)

    ## Completion Verification
    [ ] Form properly creates record (example)
    `
- Create a directory at `PATH_TO_PLAN` called `sections`
- If there is not a `PROGRESS.md` in the `PATH_TO_PLAN` then create it. The format should be:
IMPORTANT: Dont fill out all of the sections yet. Just create the file and the structure of it, fill out the sections when specifically asked to.
    `
    ## Progress
    Status: *Plan Status* Can be one of the following statuses: "Ready To Start", "In Progress", "Completed". On creation set it to "Ready To Start"

    [ ] Section: create-data-model.md - section short description (example: Create data models for the creation form)
    [ ] Section: second-section.md - Section 2 description
    `
- Foreach "Plan Section" then follow the workflow below:
    <plan-section>
        - Create a md file in `sections` with an appropriate title for the section. The title must be lowercase, no spaces, with dashes, short. For example, create-data-model.md
        - Add the *Plan Section* content into the file
        - Add this section to PROGRESS.md with the specified formatting.
    </plan-section>
- Update `PATH_TO_PLAN`/PLANNING.md if there is conflicting information. This document will be used to give other developers a higher level view on how the sections work together when they are developing a section. Dont remove any important information or context, just make it more concise, not conflicting, and easy to understand flow of the feature as a whole. 

## Report
Plan created with the following sections:
- Section 1 Short Description
- Section 2 Short Description
