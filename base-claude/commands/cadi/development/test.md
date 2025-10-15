---
description: Universal test runner that detects project framework and runs appropriate tests
argument-hint: [optional: test filter or path]
---

# Test

Run the test suite with automatic framework detection.

## Variables

- **TEST_FILTER**: $ARGUMENTS (optional test filter, path, or name)

## Workflow

### Step 1: Detect Test Framework

Check for framework and test runner:
- If `artisan` exists: Laravel (PHPUnit/Pest)
- If `package.json` exists with "next": Next.js/React (Jest/Vitest)
- If `package.json` exists with "test" script: Node.js project
- If `pytest.ini` or `pyproject.toml` exists: Python (pytest)
- If `go.mod` exists: Go (go test)

### Step 2: Run Appropriate Tests

**For Laravel:**
- If **TEST_FILTER** provided: `php artisan test --filter=$TEST_FILTER`
- Otherwise: `php artisan test`

**For Next.js/Node.js:**
- If **TEST_FILTER** provided: `npm test -- $TEST_FILTER`
- Otherwise: `npm test`

**For Python:**
- If **TEST_FILTER** provided: `pytest $TEST_FILTER`
- Otherwise: `pytest`

**For Go:**
- If **TEST_FILTER** provided: `go test $TEST_FILTER`
- Otherwise: `go test ./...`

### Step 3: Report Results

Show:
- Number of tests run
- Passed/failed count
- Any failure details
- Execution time

If tests fail:
- Highlight failing tests
- Show error messages
- Suggest next steps (review logs, check implementation)

## Examples

```bash
/test                    # Run all tests
/test UserTest           # Run specific test class/file
/test authentication     # Run tests matching "authentication"
/test tests/unit/        # Run tests in specific directory
```
