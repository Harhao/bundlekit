## Why

Rollup and Rspack adapters are the remaining bundler backends. Both are currently skeleton implementations: Rollup's `run()` doesn't produce output files, and Rspack has empty dev server config and minimal config transformation. Completing them ensures all four bundlers are fully functional through the same unified interface.

## What Changes

- **Rollup adapter**: Complete config transformation (output UMD, resolve extensions/aliases, plugins: node-resolve, commonjs, typescript, babel), fix `run()` to call `bundle.write()` in prod mode
- **Rspack adapter**: Complete config transformation (output, resolve, module.rules, plugins: DefinePlugin, HtmlRspackPlugin), wire devServer from `api.buildConfig.devServer`
- Both adapters read from `IBuildConfig` consistently with Webpack/Vite patterns

## Capabilities

### New Capabilities
- `rollup-adapter`: Rollup build adapter supporting dev watch and production builds from unified config
- `rspack-adapter`: Rspack build adapter supporting dev server and production builds from unified config

### Modified Capabilities
<!-- None -->

## Impact

- Affected packages: `@devkit/bundler-rollup`, `@devkit/bundler-rspack`
- Dependency on: `@devkit/shared-utils` (types and utilities)
- Breaks nothing: skeleton code with no consumers
