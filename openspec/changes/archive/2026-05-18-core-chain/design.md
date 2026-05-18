## Design: Core Chain

### ConfigLoader

Use `jiti` to dynamically import `.devkitrc.ts`/`.devkitrc.js`. Load order: try `.devkitrc.ts` → try `.devkitrc.js` → throw error. Deep-merge user config over defaults. Resolve relative paths to absolute using `path.resolve(cwd, ...)`.

### defaultConfig

Define defaults in `lib/config/defaultConfig.ts`:
- `entry`: `{ app: "src/index" }`
- `outDir`: `dist`
- `mode`: from `NODE_ENV` (default `development`)

### Service.ts

- `--skip-plugin`: parse from CLI args, skip matching plugin names during load
- Plugin resolution from `.devkitrc.ts` `plugins` field
- Pass CLI args to `startBuilder`

### serve command

Use `commander.option()` to define `--host`, `--port`, `--https`, `--open`, `--bundler`. Parse and forward to `api.service.startBuilder()`.

### Webpack TransformConfig

Wire `IBuildConfig` fields: `entry` → webpack `entry`, `outDir` → `output.path`, `resolve.alias` → webpack `resolve.alias`, `devServer` from `IBuildConfig.devServer`.

### Vite adapter

Replace hardcoded `InlineConfig` values with `IBuildConfig`-driven values. Keep existing plugin setup (react, html plugin).
