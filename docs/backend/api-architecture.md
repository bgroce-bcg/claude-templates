---
title: Backend API Architecture
category: backend
tags: [api, rest, architecture, controllers]
summary: RESTful API patterns, controller structure, and routing conventions
---

# Backend API Architecture

## Overview

This document describes the backend API architecture and conventions used in this project.

## API Structure

### RESTful Conventions

All API endpoints follow RESTful conventions:

- `GET /api/resource` - List all resources
- `GET /api/resource/:id` - Get single resource
- `POST /api/resource` - Create new resource
- `PUT /api/resource/:id` - Update resource (full)
- `PATCH /api/resource/:id` - Update resource (partial)
- `DELETE /api/resource/:id` - Delete resource

### Controller Pattern

Controllers handle business logic and coordinate between models and views:

```javascript
// Example controller structure
class ResourceController {
  async index(req, res) {
    // List all resources
  }

  async show(req, res) {
    // Get single resource
  }

  async store(req, res) {
    // Create new resource
  }

  async update(req, res) {
    // Update resource
  }

  async destroy(req, res) {
    // Delete resource
  }
}
```

## Error Handling

### Standard Error Response

All errors return consistent JSON structure:

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Unprocessable Entity (validation)
- `500` - Internal Server Error

## Validation

### Input Validation

All inputs must be validated before processing:

```javascript
const validation = {
  rules: {
    name: 'required|string|max:255',
    email: 'required|email|unique:users',
    age: 'integer|min:18|max:120'
  }
};
```

### Validation Error Response

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "email": ["The email field is required."],
      "age": ["The age must be at least 18."]
    }
  }
}
```

## Best Practices

1. **Single Responsibility**: Each controller handles one resource
2. **Thin Controllers**: Keep business logic in services/modules
3. **Validate Early**: Validate inputs at the entry point
4. **Fail Gracefully**: Return helpful error messages
5. **Log Appropriately**: Log errors but not sensitive data
