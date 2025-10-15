---
description: Run Laravel tests with PHPUnit or Pest
---

Run the Laravel test suite:

```bash
php artisan test
```

If the user wants to run specific tests:
- Single test file: `php artisan test --filter=TestClassName`
- Single test method: `php artisan test --filter=testMethodName`
- With coverage: `php artisan test --coverage`

Show the test results and help debug any failures.
