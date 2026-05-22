## Why

The core build chain (ConfigLoader → Service → Bundler adapters) is the backbone of bundle-bundlekit. Currently ConfigLoader is fully empty, Service has multiple TODOs preventing plugin/bundler resolution, serve command option parsing is commented out, and Webpack/Vite config transformation doesn't properly consume `IBuildConfig`. Without a working core chain, no project can actually build or serve.

## What Changes

- **ConfigLoader**: Implement loading `.bundlekitrc.ts`/`.bundlekitrc.js` via `jiti`, merge with default config
- **defaultConfig**: Define sensible build defaults (entry, outDir, mode resolution)
- **Service.ts**: Implement `--skip-plugin` handling, plugin resolution from config
- **serve command**: Restore option parsing (--host, --port, --https, --open, --bundler)
- **Webpack TransformConfig**: Wire `IBuildConfig` fields to webpack Configuration (entry, output, resolve, devServer)
- **Vite adapter**: Replace hardcoded config with `IBuildConfig`-driven values

## Capabilities

### New Capabilities
- `config-loading`: Load and merge project config from `.bundlekitrc.ts`/`.bundlekitrc.js` with defaults
- `service-core`: Core service orchestration (plugin loading, bundler selection, build/serve execution)
- `webpack-adapter`: Webpack 5 build adapter consuming unified config
- `vite-adapter`: Vite build adapter consuming unified config

### Modified Capabilities
<!-- None: all new capabilities -->

## Impact

- Affected packages: `@bundlekit/service`, `@bundlekit/bundler-webpack`, `@bundlekit/bundler-vite`, `@bundlekit/shared-utils`
- New dependency: `jiti` (already in project)
- Breaks nothing: all changes are implementing empty stubs
