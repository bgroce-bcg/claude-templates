---
description: Create a commit with conventional commit format. Only use this if the user specifically asks for it.
argument-hint: [optional: commit message]
---

# Commit

Create a well-formatted commit following conventional commit standards.

## Variables

- **COMMIT_MESSAGE**: $ARGUMENTS (optional pre-written message)

## Workflow

### Step 1: Pre-Commit Quality Checks
- Run `/lint --fix` to auto-fix code quality issues
- Run `/test` to ensure all tests pass
- If tests fail, stop and report failures to user
- If lint issues remain, report them to user

### Step 2: Check Git Status
- Run `git status` to see staged and unstaged changes
- If no changes staged, ask user what files to stage
- If files provided, stage them: `git add [files]`

### Step 3: Analyze Changes
- Run `git diff --staged` to see what will be committed
- Understand the nature of changes:
  - New feature
  - Bug fix
  - Refactoring
  - Documentation
  - Testing
  - Configuration
  - Performance improvement
  - Breaking change

### Step 4: Review Recent Commits
- Run `git log --oneline -10` to see commit message style
- Check if project uses conventional commits or another pattern
- Note any project-specific conventions

### Step 5: Generate Commit Message

If **COMMIT_MESSAGE** provided:
- Validate it follows conventions
- Use it if valid, otherwise suggest improvements

Otherwise, generate using conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `style`: Code style changes (formatting, semicolons)
- `perf`: Performance improvements
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

**Scope** (optional): Component or module affected (e.g., "auth", "api", "ui")

**Subject**: Short description (50 chars or less)
- Imperative mood ("add" not "added" or "adds")
- No period at end
- Lowercase first letter

**Body** (optional): Detailed explanation
- Why the change was made
- What problem it solves
- Any important context

**Footer** (optional):
- Breaking changes: `BREAKING CHANGE: description`
- Issue references: `Closes #123`

### Step 6: Create Commit
- Present commit message to user for approval
- If approved, create commit: `git commit -m "message"`
- If multi-line message needed, use proper formatting

### Step 7: Confirm Success
- Show commit hash and message
- Run `git log -1` to confirm
- Remind about pushing if needed

## Examples

```bash
/commit                              # Interactive commit
/commit "fix(auth): resolve login timeout issue"
```

**Example generated messages:**

```
feat(rsvp): add event assignment functionality

Implements ability to assign events to RSVP records. Includes
validation and relationship management.

Closes #42
```

```
fix(api): prevent null pointer in user service

Added null check before accessing user properties to prevent
crashes when optional fields are missing.
```

```
refactor(database): optimize N+1 queries in event loader

Replaced lazy loading with eager loading for event relationships,
reducing database queries from ~100 to 3.

BREAKING CHANGE: EventLoader constructor now requires relationship array
```
