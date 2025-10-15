---
description: Universal linter that detects and runs appropriate code quality tools
argument-hint: [optional: --fix to auto-fix issues]
---

# Lint

Run code quality checks with automatic linter detection.

## Variables

- **FIX_MODE**: If $ARGUMENTS contains "--fix", enable auto-fix mode
- **TARGET_PATH**: Optional path argument (defaults to current directory)

## Workflow

### Step 1: Detect Available Linters

Check for configuration files and tools:
- **JavaScript/TypeScript**: `.eslintrc.*`, `eslint.config.*` (ESLint)
- **Prettier**: `.prettierrc.*` (Prettier)
- **PHP**: `phpcs.xml`, `pint.json` (PHP_CodeSniffer, Laravel Pint)
- **Python**: `.flake8`, `pyproject.toml` (flake8, black, ruff)
- **Go**: Use `gofmt` or `golangci-lint`

### Step 2: Run Linters

**For JavaScript/TypeScript projects:**
- If **FIX_MODE**: `npm run lint -- --fix` or `eslint . --fix`
- Otherwise: `npm run lint` or `eslint .`
- Then run Prettier if available: `prettier --check .` (or `--write` if fix mode)

**For PHP/Laravel projects:**
- If Laravel Pint exists: `./vendor/bin/pint` (auto-fixes by default)
- Else if PHP_CodeSniffer: `./vendor/bin/phpcs` (or `phpcbf` if fix mode)

**For Python projects:**
- If ruff exists: `ruff check .` (or `ruff check --fix .` if fix mode)
- Else if flake8: `flake8 .`
- Then run black if available: `black --check .` (or `black .` if fix mode)

**For Go projects:**
- Run `gofmt -l .` (or `gofmt -w .` if fix mode)
- If golangci-lint exists: `golangci-lint run`

### Step 3: Report Results

Show:
- Which linters ran
- Number of issues found
- Auto-fixed issues (if fix mode)
- Remaining issues requiring manual attention

If issues found:
- Show file and line numbers
- Group by issue type
- Suggest fixes or point to documentation

## Examples

```bash
/lint                # Check all files
/lint --fix          # Check and auto-fix issues
/lint src/           # Check specific directory
/lint --fix src/     # Fix specific directory
```
