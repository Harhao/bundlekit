---
"@bundlekit/bundler-rollup": patch
"@bundlekit/plugin-react": patch
"@bundlekit/plugin-vue": patch
---

Fix tslib dependency in rollup bundler and update template versions

- Move tslib from devDependencies to dependencies in @bundlekit/bundler-rollup to fix build error
- Update template package versions from workspace:^ to * for automatic latest version installation