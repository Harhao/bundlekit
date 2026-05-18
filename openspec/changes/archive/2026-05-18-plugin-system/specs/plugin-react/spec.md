## ADDED Requirements

### Requirement: Plugin registration
The React plugin SHALL export a valid `IPluginAPI` object that registers itself with the service on initialization.

#### Scenario: Plugin registers command
- **WHEN** the React plugin is loaded by the service
- **THEN** it SHALL register a `plugin:react` command via `api.registerCommand`

### Requirement: Build config modification
The React plugin SHALL modify the build config via `api.modifyBuildConfig` to enable JSX/TSX support and React-specific Babel presets.

#### Scenario: JSX support added
- **WHEN** the React plugin modifies the build config
- **THEN** the build config SHALL include JSX compilation settings (e.g., `jsx: "react-jsx"` for Vite, or appropriate babel preset for Webpack)

### Requirement: Project templates
The React plugin SHALL provide `template-react-ts` and `template-react-js` templates with a working React project structure.

#### Scenario: TypeScript template structure
- **WHEN** the `template-react-ts` template is used
- **THEN** it SHALL contain `src/App.tsx`, `src/index.tsx`, `tsconfig.json`, `package.json`, and `.devkitrc.ts`
