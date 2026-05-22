---
"@bundlekit/service": minor
"@bundlekit/shared-utils": minor
"@bundlekit/bundler-webpack": minor
"@bundlekit/bundler-vite": minor
"@bundlekit/bundler-rspack": minor
"@bundlekit/bundler-rollup": minor
"@bundlekit/bundler-rolldown": minor
"@bundlekit/cli": minor
"@bundlekit/plugin-react": minor
"@bundlekit/plugin-vue": minor
---

Add SSR (server-side rendering) support across all 5 bundlers.

**New `ssr` config field on `IEnvBuildConfig`** with `entry`, `output`, `externals`, `template`, `placeholder`, `dev` fields. When set, `bundlekit-service build` runs two sequential passes (client + server) producing dual bundle artifacts. When `ssr.dev: true` and command is `serve`, service starts a dev SSR HTTP server using the bundler's `createSSRMiddleware`.

**Build SSR — supported on all 5 bundlers**:
- vite: native `build.ssr` mode
- webpack / rspack: `target: 'node'` + `library.type` switched to `commonjs2` / `module` based on `ssr.output.formats`
- rollup / rolldown: single-format `cjs` / `es` output to `ssr.output.dir`
- `externals: 'auto'` automatically externalizes project `dependencies` / `peerDependencies` and `node:` builtins

**Dev SSR middleware — supported on all 5 bundlers**:
- vite: native `createServer({ middlewareMode: true })` + `ssrLoadModule` + `transformIndexHtml`，full client + server HMR
- webpack: `webpack-dev-middleware` + `webpack-hot-middleware` + separate server compiler watch + require cache invalidation
- rspack: `RspackDevServer` middleware mode + separate server compiler watch
- rollup / rolldown: `watch()` + ssrHandler，no HMR injection（编辑后重新 require server bundle）

**Service-level orchestration**:
- New `startSSRDevServer` helper: zero-dependency http server + connect-style middleware chain runner（不依赖 connect 包）
- `Service.startBuilder` automatically routes between client-only / dev SSR / build SSR based on `envConfig.ssr` and command
- New shared utils `createSSRRequestHandler` and `buildSSRView` / `resolveSSRExternals` factored out of service to be reusable across bundlers

**`tools` hook (from add-config-escape-hatch)** receives `ctx.env: 'client' | 'server'` so user-side hooks can branch on pass.

**Schema validation** rejects mutually exclusive combos:
- `ssr` + `target: 'node'`
- `ssr` + non-empty `pages[]` (SPA SSR only in v1)

**New `IBuildToolAdapter.createSSRMiddleware?` optional method** for dev SSR middleware. New `IRequestHandler` type exported from shared-utils.

**Templates updated** (`@bundlekit/plugin-react`, `@bundlekit/plugin-vue`):
- All 4 templates (react-ts, react-js, vue3-ts, vue3-js) now include `App.{tsx,vue}`, `entry-client.{tsx,ts,jsx,js}`, `entry-server.{tsx,ts,jsx,js}` — these files are always generated but only referenced in `.bundlekitrc.ts` when SSR is enabled
- `public/index.html` now contains `<!--ssr-outlet-->` placeholder
- `.bundlekitrc.ts` conditionally includes `ssr` config block when context `ssr === true`

**`@bundlekit/cli` `create` command new flag `--ssr`**: passing this flag sets `ssr: true` in the template context, switching the generated `.bundlekitrc.ts` to the SSR config form (drops `pages`, adds `ssr` block with `dev: true`).

Migration: existing projects unaffected. New projects without `--ssr` continue to use the SPA flow. To enable SSR on an existing project, manually add the `ssr` field to `.bundlekitrc.ts` referencing your `entry-server.tsx`.
