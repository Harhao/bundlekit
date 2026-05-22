## Context

Vue 3 uses Single File Components (`.vue` files) containing `<template>`, `<script>`, and `<style>` blocks. Vite has first-class Vue support via `@vitejs/plugin-vue`. For TypeScript projects, `vue-tsc` provides type checking.

Current state: bundlekit supports React only via `@bundlekit/plugin-react`. The plugin pattern (register command, modify build config, provide templates) is already established and can be replicated.

## Goals / Non-Goals

**Goals:**
- Create `@bundlekit/plugin-vue` package mirroring the React plugin structure
- Provide `vue3-ts` and `vue3-js` templates in `templates/` directory
- Template includes: `App.vue`, `main.ts/js`, `.bundlekitrc.ts/js`, `package.json`, `tsconfig.json`, `public/index.html`
- Register in CLI template selector (`bundlekit-cli/index.ts`)
- Default bundler: `vite` (Vue 3 + Vite is the standard setup)

**Non-Goals:**
- Vue Router / Pinia integration (user adds manually)
- Nuxt support
- Vue 2 support

## Decisions

### 1. Target Vite as default bundler
Vue 3 + Vite is the official recommended setup. The Vue SFC compilation requires `@vitejs/plugin-vue` which integrates naturally with Vite. Webpack/Rspack can work but need `vue-loader` — out of scope for initial release.

### 2. Template uses Composition API with `<script setup>`
The modern Vue 3 default. Cleaner syntax, better TypeScript inference.

### 3. Mirror React plugin structure
Same file layout: `index.ts` (plugin entry), `templates/vue3-ts/`, `templates/vue3-js/`. Consistent with existing patterns.

### 4. Plugin modifies Vite config for Vue SFC support
The `apply()` method injects `@vitejs/plugin-vue` into the build config resolution extensions and registers the plugin.

## Risks / Trade-offs

- [Vue SFC only works with Vite out of box] → Other bundlers need `vue-loader`. Document that Vite is recommended for Vue projects.
- [Vue community expects Vue Router + Pinia] → These are user-added dependencies, not part of the scaffold. Document how to add them.
