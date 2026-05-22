## 1. Vue Plugin Package

- [x] 1.1 Create `@bundlekit/plugin-vue` package with `package.json`, `tsconfig.json`
- [x] 1.2 Add dependencies: `@bundlekit/shared-utils` (workspace), `@vitejs/plugin-vue`
- [x] 1.3 Implement `index.ts` plugin entry: `registerPlugin`, `plugin:vue` command, build config injection
- [x] 2.1 Create `templates/vue3-ts/` structure: `.bundlekitrc.ts`, `package.json`, `tsconfig.json`, `src/App.vue`, `src/main.ts`, `public/index.html`
- [x] 2.2 Create `templates/vue3-js/` structure: `.bundlekitrc.js`, `package.json`, `src/App.vue`, `src/main.js`, `public/index.html`
- [x] 3.1 Add `vue3-ts` and `vue3-js` to template selector list in `bundlekit-cli/index.ts`
- [x] 3.2 Add `@bundlekit/plugin-vue` as workspace dependency of `@bundlekit/cli`

## 4. Verification

- [x] 4.1 `pnpm install` links all dependencies
- [x] 4.2 `bundlekit-cli create test-vue3 -t vue3-ts -b vite` creates valid project
- [x] 4.3 `pnpm --filter test-vue3 run dev` starts Vite dev server
