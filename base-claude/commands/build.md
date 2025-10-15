---
decription: Build the plan
argument-hint: [path to planned feature]
---

# Build

## Variables
`PATH_TO_PLAN` = docs/plans/$ARGUMENTS

## Workflow
- If you have not already run /prime-backend this session, then Run /prime-backend slash command. If you have, then skip this step.
- Find the first section in this plan that is not completed (found at `PATH_TO_PLAN`/PROGRESS.md ):

    <build-section>
    - use a new plan-section-builder agent and provide it with the following:
            - **section_md_file_path**: The name and path of the section md you're building, located in a "sections" sub directory (e.g., "docs/plans/rsvp/sections/assign-events.md")
            - **planning_document_path**: Path to the PLANNING.md
            - **context_requirements**: (Optional) Any specific context or files that need to be loaded for this section
    </build-section>
    
- Wait until plan-section-builder is complete.
- Reload PROGRESS.md - If all sections are complete in PROGRESS.md then report back to user.
- If not, execute the workflow again with the next section.
- If all of the sections have been built and marked complete, then run the "/complete-plan" command. You will need to give the feature name that matches the directory name as an argument.

## Report
Give a short status report for each section that was built from the PROGRESS.md sheet.