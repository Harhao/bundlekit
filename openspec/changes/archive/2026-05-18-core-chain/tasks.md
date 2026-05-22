## 1. ConfigLoader Implementation

- [x] 1.1 Implement `loadDevkitFileConfig()` using jiti to load `.bundlekitrc.ts` or `.bundlekitrc.js`
- [x] 1.2 Implement `defaultConfig()` with sensible defaults (entry, outDir, mode)
- [x] 1.3 Implement `resolveAllConfig()` deep-merging user config over defaults, resolving relative paths to absolute
- [x] 1.4 Remove empty stub methods (`loadEnvConfig`, `loadTomlConfig`, `mergeAllConfig`) and simplify ConfigLoader

## 2. Service Core Fixes

- [x] 2.1 Implement `--skip-plugin` parsing from CLI args
- [x] 2.2 Wire plugin loading from `.bundlekitrc.ts` plugins field
- [x] 2.3 Resolve remaining TODOs in Service.ts

## 3. Serve Command

- [x] 3.1 Restore option parsing for `--host`, `--port`, `--https`, `--open`, `--bundler`
- [x] 3.2 Pass parsed options to `api.service.startBuilder()`

## 4. Webpack Adapter Fixes

- [x] 4.1 Wire `IBuildConfig.entry` → webpack entry config
- [x] 4.2 Wire `IBuildConfig.outDir` → webpack output.path
- [x] 4.3 Wire `IBuildConfig.resolve` → webpack resolve config
- [x] 4.4 Wire `IBuildConfig.devServer` → webpack devServer config

## 5. Vite Adapter Fixes

- [x] 5.1 Replace hardcoded entry with `IBuildConfig.entry`
- [x] 5.2 Replace hardcoded outDir with `IBuildConfig.outDir`
- [x] 5.3 Wire devServer from `IBuildConfig.devServer` and CLI args

## 6. Verification

- [x] 6.1 Run `pnpm build` for all affected packages
- [x] 6.2 Verify example project can build/serve with webpack and vite
