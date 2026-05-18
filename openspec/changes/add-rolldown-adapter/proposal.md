## Why

Rolldown is a Rust-based JavaScript bundler with Rollup-compatible API, designed to be the unified bundler powering Vite 8+. It provides esbuild-level performance (~10-30x faster than Rollup) with Rollup's plugin ecosystem compatibility. Adding a Rolldown adapter completes the multi-bundler strategy, giving users access to the next-generation bundler alongside Webpack, Vite, Rollup, and Rspack.

## What Changes

- New package `@devkit/bundler-rolldown` implementing `IBuildToolAdapter<RolldownOptions>`
- Config transformation: `IBuildConfig` → Rolldown `RolldownOptions` (entry, output, resolve, plugins, define, inject)
- Dev mode: `rolldown.watch()` with rebuild logging
- Prod mode: `rolldown.build()` producing output to configured `outDir`
- Built-in transforms for TypeScript/JSX (native in Rolldown, no extra loaders needed)
- Schema validation using Rolldown's schema
- Register `rolldown` in bundler resolution system (`@devkit/service`)
- Update example project `package.json` with `rolldown:dev` / `rolldown:prod` scripts

## Capabilities

### New Capabilities
- `rolldown-adapter`: Rolldown build adapter supporting dev watch and production builds from unified `IBuildConfig`

### Modified Capabilities
<!-- None -->

## Impact

- New package: `@devkit/bundler-rolldown`
- Dependency: `rolldown` npm package
- Modified packages: `@devkit/service` (add `rolldown` to bundler map and dependencies), `exmaple` (add rolldown scripts)
- Breaking: none (additive change)
