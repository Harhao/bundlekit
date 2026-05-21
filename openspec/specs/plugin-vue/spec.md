# plugin-vue Specification

## Purpose
TBD - created by archiving change add-vue3-support. Update Purpose after archive.
## Requirements
### Requirement: Plugin registration
The Vue plugin SHALL export a valid `IPluginAPI` object with `registerPlugin` method, registering itself as `@devkit/plugin-vue`.

#### Scenario: Plugin initializes with service
- **WHEN** the Vue plugin is loaded by the service
- **THEN** it SHALL register a `plugin:vue` command via `api.registerCommand`

### Requirement: Build config modification
The Vue plugin SHALL inject Vue 3 build configuration via `api.modifyBuildConfig`, including `@vitejs/plugin-vue` plugin registration and `.vue` file resolution.

#### Scenario: Vue SFC support injected
- **WHEN** the Vue plugin modifies the build config
- **THEN** the build config SHALL include `@vitejs/plugin-vue` in the Vite plugin list and `.vue` extension in resolve

### Requirement: Project templates
The Vue plugin SHALL provide `template-vue3-ts` and `template-vue3-js` templates with a working Vue 3 project structure.

#### Scenario: TypeScript template structure
- **WHEN** the `vue3-ts` template is used
- **THEN** it SHALL contain `src/App.vue`, `src/main.ts`, `tsconfig.json`, `package.json`, `.devkitrc.ts`, `public/index.html`

#### Scenario: JavaScript template structure
- **WHEN** the `vue3-js` template is used
- **THEN** it SHALL contain `src/App.vue`, `src/main.js`, `package.json`, `.devkitrc.js`, `public/index.html`

