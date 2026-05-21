## Context

Rolldown (`rolldown` npm package) is a Rust-based JavaScript bundler with Rollup-compatible API. It exposes `rolldown()` / `rolldown.build()` / `rolldown.watch()` functions and accepts `RolldownOptions` similar to Rollup's `RollupOptions`. Unlike Rollup, Rolldown has built-in TypeScript/JSX/syntax-lowering transforms (like esbuild), so no extra loader plugins are needed.

Current state: bundle-devkit has 4 bundler adapters (Webpack, Vite, Rollup, Rspack). The `@devkit/service` resolves bundlers dynamically from `@devkit/bundler-{name}` packages. The service has a default bundler map that needs a `rolldown` entry.

## Goals / Non-Goals

**Goals:**
- Create `@devkit/bundler-rolldown` package implementing `IBuildToolAdapter`
- Transform `IBuildConfig` → `RolldownOptions` (input, output, resolve, devServer for proxy)
- Support `development` (watch) and `production` (build) modes
- Register in service's bundler resolution and default map
- Add `rolldown:dev` / `rolldown:prod` scripts to example project

**Non-Goals:**
- HMR support (Rolldown feature is WIP)
- Module Federation
- CSS bundling (experimental in Rolldown)
- Advanced chunk splitting control
- Schema validation via `schema-utils` (Rolldown has its own validation)

## Decisions

### 1. Use `rolldown` package directly (not `@rolldown/node`)
Rolldown's main npm package is `rolldown`. It provides the bundler API matching Rollup's interface. This is the simplest and most direct integration.

### 2. Leverage built-in transforms instead of plugins
Unlike the Rollup adapter which needs `@rollup/plugin-typescript` and `@rollup/plugin-babel`, Rolldown natively supports TypeScript/JSX/syntax-lowering. The adapter will configure these via `RolldownOptions` directly, not via plugins.

### 3. Follow Rollup adapter's code pattern
Since Rolldown has a Rollup-compatible API, the adapter structure mirrors the Rollup adapter: `transformConfig()` converts config, `validateConfig()` handles validation, `run()` dispatches to watch or build.

### 4. Output format: ES module by default
Rolldown supports `es`, `cjs`, and `iife` formats. Default to `es` for the best compatibility with Vite and modern tooling. Map `IBuildConfig.output.formats` accordingly.

## Risks / Trade-offs

- [Rolldown is still evolving (pre-1.0)] → API may change. Pin to a specific version in `package.json`.
- [Rolldown may not be in the npm registry the service fetches from] → Falls back to local `node_modules` resolution, same as other bundlers.
- [HMR is WIP] → Dev watch mode works, but HMR depends on Rolldown's future releases.
- [Schema validation schema-utils may not match Rolldown's actual schema] → Skip `schema-utils` validation, rely on Rolldown's own error reporting (same approach as rspack adapter).
