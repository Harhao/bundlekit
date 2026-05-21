---
"@devkit/service": minor
"@devkit/shared-utils": minor
"@devkit/bundler-webpack": minor
"@devkit/bundler-vite": minor
"@devkit/bundler-rspack": minor
"@devkit/bundler-rollup": minor
"@devkit/bundler-rolldown": minor
---

Add SSR (server-side rendering) support across all 5 bundlers.

**New `ssr` config field on `IEnvBuildConfig`** with `entry`, `output`, `externals`, `template`, `placeholder` fields. When set, `devkit-service build` runs two sequential passes (client + server) producing dual bundle artifacts.

**Build SSR — supported on all 5 bundlers**:
- vite: native `build.ssr` mode
- webpack / rspack: `target: 'node'` + `library.type` switched to `commonjs2`/`module` based on `ssr.output.formats`
- rollup / rolldown: single-format `cjs`/`es` output to `ssr.output.dir`
- `externals: 'auto'` automatically externalizes project `dependencies` / `peerDependencies` and `node:` builtins

**Dev SSR middleware** — first release ships:
- vite: full `createSSRMiddleware` using `ssrLoadModule` + `transformIndexHtml`, supports HMR
- webpack / rspack / rollup / rolldown: scaffold ready, `createSSRMiddleware` to be added in subsequent release

**`tools` hook (from add-config-escape-hatch)** receives `ctx.env: 'client' | 'server'` so user-side hooks can branch on pass.

**Schema validation** rejects mutually exclusive combos:
- `ssr` + `target: 'node'`
- `ssr` + non-empty `pages[]` (SPA SSR only in v1)

**New `IBuildToolAdapter.createSSRMiddleware?` optional method** for dev SSR middleware. New `IRequestHandler` type exported from shared-utils.
