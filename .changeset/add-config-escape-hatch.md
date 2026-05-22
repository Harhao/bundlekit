---
"@bundlekit/service": minor
"@bundlekit/shared-utils": minor
---

Add per-bundler escape hatch via `tools` field on `IBuildConfig`.

- New `tools.<bundler>` hooks let users patch the native config for each bundler with full type inference (webpack `Configuration`, vite `InlineConfig`, rspack `RspackOptions`, rollup `RollupOptions`, rolldown `unknown`).
- Hooks accept `(config, ctx)` where `ctx = { mode, command, env, bundler }`. `env` defaults to `'client'` and will be set to `'server'` during SSR server pass (see `add-ssr-support`).
- Call order: `transformConfig → tools[bundler]?() → changeConfigure → run`.
- Return semantics: returning `undefined` / `void` uses the mutated config; returning a new object replaces it.
- Errors thrown by hooks propagate (no swallowing).
- `changeConfigure` remains as a global fallback hook unchanged.
