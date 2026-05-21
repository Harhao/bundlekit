## Why

Currently bundle-devkit only supports React project templates (`react-ts`, `react-js`). Vue 3 is a major frontend framework with a large user base. Adding Vue 3 template support extends the toolkit's reach, enabling users to scaffold Vue 3 + TypeScript/JavaScript projects with the same `devkit-cli create` command and unified build configuration.

## What Changes

- New package `@devkit/plugin-vue` providing Vue 3 build config injection and templates
- New templates: `vue3-ts` (Vue 3 + TypeScript + Vite) and `vue3-js` (Vue 3 + JavaScript + Vite)
- Plugin registers `plugin:vue` command, injects `@vitejs/plugin-vue` into build config
- CLI `create` command adds `vue3-ts` / `vue3-js` to interactive template selector
- Vue 3 project structure: `src/App.vue`, `src/main.ts`, and Vite-based `.devkitrc.ts`

## Capabilities

### New Capabilities
- `plugin-vue`: Vue 3 build configuration injection and project templates
- `cli-create`: adds `vue3-ts` / `vue3-js` template support

### Modified Capabilities
<!-- None -->

## Impact

- New packages: `@devkit/plugin-vue`
- Modified packages: `@devkit/cli` (template list + dependency), `@devkit/plugin-vue/templates/`
- Dependencies: `vue@^3.5`, `@vitejs/plugin-vue`, `vue-tsc`
- No breaking changes: additive feature
