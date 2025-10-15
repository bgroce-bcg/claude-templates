---
title: Component Patterns
category: frontend
tags: [react, components, ui, patterns]
summary: React component patterns, composition, and best practices
---

# Component Patterns

## Overview

This document describes component patterns and conventions for building UI.

## Component Structure

### Functional Components

Always use functional components with hooks:

```jsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <LoadingSpinner />;
  if (!user) return <NotFound />;

  return (
    <div className="user-profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Component Organization

```
components/
  UserProfile/
    UserProfile.jsx          # Main component
    UserProfile.test.jsx     # Tests
    UserProfile.module.css   # Styles (if needed)
    index.js                 # Export
```

## Composition Patterns

### Container/Presentation Pattern

Separate data fetching from presentation:

```jsx
// Container (handles data)
function UserProfileContainer({ userId }) {
  const { data: user, loading, error } = useUser(userId);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <UserProfile user={user} />;
}

// Presentation (pure component)
function UserProfile({ user }) {
  return (
    <div className="user-profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

### Compound Components

For flexible, composable components:

```jsx
function Tabs({ children }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.List = function TabsList({ children }) {
  return <div className="tabs-list">{children}</div>;
};

Tabs.Tab = function Tab({ index, children }) {
  const { activeTab, setActiveTab } = useTabsContext();
  return (
    <button
      className={activeTab === index ? 'active' : ''}
      onClick={() => setActiveTab(index)}
    >
      {children}
    </button>
  );
};

Tabs.Panel = function TabPanel({ index, children }) {
  const { activeTab } = useTabsContext();
  return activeTab === index ? <div>{children}</div> : null;
};

// Usage
<Tabs>
  <Tabs.List>
    <Tabs.Tab index={0}>Tab 1</Tabs.Tab>
    <Tabs.Tab index={1}>Tab 2</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel index={0}>Content 1</Tabs.Panel>
  <Tabs.Panel index={1}>Content 2</Tabs.Panel>
</Tabs>
```

## Props Patterns

### Prop Types with TypeScript

```typescript
interface UserProfileProps {
  user: User;
  onEdit?: (user: User) => void;
  className?: string;
  children?: React.ReactNode;
}

function UserProfile({ user, onEdit, className, children }: UserProfileProps) {
  // ...
}
```

### Prop Spreading

Spread remaining props to support extensibility:

```jsx
function Button({ variant = 'primary', children, ...props }) {
  return (
    <button className={`btn btn-${variant}`} {...props}>
      {children}
    </button>
  );
}

// Usage
<Button onClick={handleClick} disabled={loading} aria-label="Submit">
  Submit
</Button>
```

## State Management

### Local State

Use `useState` for component-local state:

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Context for Shared State

Use Context for state shared across component tree:

```jsx
const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

## Best Practices

1. **Keep Components Small**: Single responsibility principle
2. **Prefer Composition**: Over inheritance or complex props
3. **Handle Loading/Error States**: Always consider these states
4. **Use TypeScript**: For better type safety
5. **Write Tests**: Test user interactions, not implementation
6. **Accessibility**: Include ARIA attributes, keyboard navigation
7. **Memoization**: Use `useMemo`/`useCallback` for expensive operations
