## Variables

- `$FEATURE`: Optional feature name passed as argument (e.g., `/prime-backend guests`)

## Workflow

1. Read all markdown files in `docs/backend/` directory to understand the backend architecture:

2. If `$FEATURE` argument is provided:
   - Check if `docs/features/$FEATURE/` directory exists
   - If it exists, read all markdown files in that directory for feature-specific details
   - If it doesn't exist, skip this step and proceed with general backend knowledge

3. Be ready to explain the backend architecture, including:
   - **Core layers**: models (data access), modules (business logic), store (state management), pages/api (routes)
   - **Data models**: Structures of data models in the project, where the data is stored
   - **State management**: Redux Toolkit slices, custom hooks, loading/error states
   - **Business logic**: Controllers, validation, API integration patterns
   - **Error handling**: Graceful degradation, safe defaults, user-friendly messages

4. When answering questions or implementing features:
   - Follow the documented patterns and conventions
   - Use the appropriate layer (models for data, modules for logic, store for state)
   - Reference specific files and line numbers when relevant