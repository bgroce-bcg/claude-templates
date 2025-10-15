---
title: Database Patterns
category: backend
tags: [database, models, orm, queries]
summary: Database access patterns, model conventions, and query optimization
---

# Database Patterns

## Overview

This document describes database access patterns and conventions.

## Model Structure

### Base Model

All models extend a base model with common functionality:

```javascript
class BaseModel {
  // Common fields
  id
  created_at
  updated_at

  // Common methods
  save()
  delete()
  refresh()
}
```

### Model Conventions

- **Naming**: Singular, PascalCase (e.g., `User`, `BlogPost`)
- **Table names**: Plural, snake_case (e.g., `users`, `blog_posts`)
- **Primary key**: Always `id` (auto-incrementing integer)
- **Timestamps**: Always include `created_at` and `updated_at`

## Query Patterns

### Basic Queries

```javascript
// Find by ID
const user = await User.find(1);

// Find with conditions
const users = await User.where({ status: 'active' }).get();

// Find one
const user = await User.where({ email: 'user@example.com' }).first();
```

### Relationships

```javascript
// One-to-Many
class User extends BaseModel {
  posts() {
    return this.hasMany(Post);
  }
}

class Post extends BaseModel {
  user() {
    return this.belongsTo(User);
  }
}

// Usage
const user = await User.find(1);
const posts = await user.posts().get();
```

### Eager Loading

Avoid N+1 queries by eager loading relationships:

```javascript
// Bad (N+1 queries)
const users = await User.all();
for (const user of users) {
  const posts = await user.posts().get(); // Query per user!
}

// Good (2 queries)
const users = await User.with('posts').get();
```

## Transactions

Use transactions for operations that must succeed or fail together:

```javascript
await db.transaction(async (trx) => {
  const user = await User.create({ name: 'John' }, trx);
  const profile = await Profile.create({ user_id: user.id }, trx);
  return user;
});
```

## Best Practices

1. **Use Indexes**: Index foreign keys and frequently queried columns
2. **Avoid N+1**: Always eager load relationships when needed
3. **Use Transactions**: For multi-step operations
4. **Soft Deletes**: Consider soft deletes for important data
5. **Migrations**: Version control all schema changes
