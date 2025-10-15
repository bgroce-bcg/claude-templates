# Complete Plan
Take in a FEATURE varialbe, then execute the Workflow, then Report back to the user.

## Variables

- `FEATURE`= $ARGUMENTS: feature the plan implemented (e.g., `storage-locations`)

## Workflow

1. Check if docs/feature/`FEATURE`/README.md exists. If not, then stop immediately and tell the user that there is no README.md at the feature location.

2. Read docs/feature/`FEATURE`/README.md and remove any duplicate information or information that is not very helpful to a developer to understand what this feature does. This README should be inforfmation dense and help get the full context of this feature including how it works and how it is built. You dont need to code to it unless it is a short example.

3. If every section is marked as completed in the document docs/plans/`FEATURE`/PROGRESS.md, then remove the directory and children for the plan. located at: docs/plans/`FEATURE`/

## Report

Report back to the user that the plan has been cleaned up and documented.