---
title: Form Validation
category: frontend
tags: [forms, validation, react, hooks]
summary: Form handling patterns, validation strategies, and error display
---

# Form Validation

## Overview

This document describes form handling and validation patterns.

## Form Structure

### Controlled Components

Always use controlled components for forms:

```jsx
function LoginForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
      />
      <input
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

## Validation Patterns

### Client-Side Validation

Validate on blur or submit:

```jsx
function useFormValidation(initialValues, validationRules) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validate = (fieldName, value) => {
    const rules = validationRules[fieldName];
    if (!rules) return null;

    // Required check
    if (rules.required && !value) {
      return `${fieldName} is required`;
    }

    // Email check
    if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Invalid email format';
    }

    // Min length
    if (rules.minLength && value.length < rules.minLength) {
      return `Minimum ${rules.minLength} characters required`;
    }

    // Custom validation
    if (rules.custom) {
      return rules.custom(value);
    }

    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched({ ...touched, [name]: true });

    const error = validate(name, value);
    if (error) {
      setErrors({ ...errors, [name]: error });
    }
  };

  const validateAll = () => {
    const newErrors = {};
    Object.keys(validationRules).forEach(fieldName => {
      const error = validate(fieldName, values[fieldName]);
      if (error) newErrors[fieldName] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll
  };
}

// Usage
function RegistrationForm() {
  const validation = useFormValidation(
    { email: '', password: '', name: '' },
    {
      email: { required: true, email: true },
      password: { required: true, minLength: 8 },
      name: { required: true }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validation.validateAll()) {
      // Submit form
      submitForm(validation.values);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField
        name="email"
        label="Email"
        value={validation.values.email}
        error={validation.touched.email && validation.errors.email}
        onChange={validation.handleChange}
        onBlur={validation.handleBlur}
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        value={validation.values.password}
        error={validation.touched.password && validation.errors.password}
        onChange={validation.handleChange}
        onBlur={validation.handleBlur}
      />
      <button type="submit">Register</button>
    </form>
  );
}
```

## Error Display

### Field-Level Errors

Show errors below fields:

```jsx
function FormField({ name, label, error, ...inputProps }) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        {...inputProps}
      />
      {error && (
        <span id={`${name}-error`} className="error-message">
          {error}
        </span>
      )}
    </div>
  );
}
```

### Form-Level Errors

Show general errors at top of form:

```jsx
function FormErrors({ errors }) {
  if (!errors || errors.length === 0) return null;

  return (
    <div className="form-errors" role="alert">
      <ul>
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Loading States

Handle loading during submission:

```jsx
function SubmitButton({ loading, children }) {
  return (
    <button type="submit" disabled={loading}>
      {loading ? (
        <>
          <Spinner /> Submitting...
        </>
      ) : (
        children
      )}
    </button>
  );
}
```

## Best Practices

1. **Validate Early**: Show errors on blur, not on every keystroke
2. **Clear Errors**: Clear errors when user starts fixing them
3. **Disable Submit**: Disable submit button during loading
4. **Server Validation**: Always validate on server too
5. **Helpful Messages**: Make error messages actionable
6. **Accessibility**: Use ARIA attributes for screen readers
7. **Prevent Double Submit**: Disable button after first submit
