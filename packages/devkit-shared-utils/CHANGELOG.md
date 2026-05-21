# @devkit/shared-utils

## 0.1.0

### Minor Changes

- 8cc286d: Add per-bundler escape hatch via `tools` field on `IBuildConfig`.

  - New `tools.<bundler>` hooks let users patch the native config for each bundler with full type inference (webpack `Configuration`, vite `InlineConfig`, rspack `RspackOptions`, rollup `RollupOptions`, rolldown `unknown`).
  - Hooks accept `(config, ctx)` where `ctx = { mode, command, env, bundler }`. `env` defaults to `'client'` and will be set to `'server'` during SSR server pass (see `add-ssr-support`).
  - Call order: `transformConfig → tools[bundler]?() → changeConfigure → run`.
  - Return semantics: returning `undefined` / `void` uses the mutated config; returning a new object replaces it.
  - Errors thrown by hooks propagate (no swallowing).
  - `changeConfigure` remains as a global fallback hook unchanged.

- 8cc286d: Add SSR (server-side rendering) support across all 5 bundlers.

  **New `ssr` config field on `IEnvBuildConfig`** with `entry`, `output`, `externals`, `template`, `placeholder`, `dev` fields. When set, `devkit-service build` runs two sequential passes (client + server) producing dual bundle artifacts. When `ssr.dev: true` and command is `serve`, service starts a dev SSR HTTP server using the bundler's `createSSRMiddleware`.

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

  **Templates updated** (`@devkit/plugin-react`, `@devkit/plugin-vue`):

  - All 4 templates (react-ts, react-js, vue3-ts, vue3-js) now include `App.{tsx,vue}`, `entry-client.{tsx,ts,jsx,js}`, `entry-server.{tsx,ts,jsx,js}` — these files are always generated but only referenced in `.devkitrc.ts` when SSR is enabled
  - `public/index.html` now contains `<!--ssr-outlet-->` placeholder
  - `.devkitrc.ts` conditionally includes `ssr` config block when context `ssr === true`

  **`@devkit/cli` `create` command new flag `--ssr`**: passing this flag sets `ssr: true` in the template context, switching the generated `.devkitrc.ts` to the SSR config form (drops `pages`, adds `ssr` block with `dev: true`).

  Migration: existing projects unaffected. New projects without `--ssr` continue to use the SPA flow. To enable SSR on an existing project, manually add the `ssr` field to `.devkitrc.ts` referencing your `entry-server.tsx`.

- 9c0890e: Adopt workspace protocol for template dependencies; align package versions; add release pipeline + contributor docs.

  **Template dependencies switched to `workspace:^`**:

  - All four templates (`react-ts`, `react-js`, `vue3-ts`, `vue3-js`) now declare `@devkit/*` internal package dependencies as `workspace:^` in `package.json.ejs`.
  - CLI introduces a new `normalizeDeps` step right after template rendering that replaces every `workspace:^` literal with either:
    - `link:/abs/path/to/packages/devkit-<name>` when running inside the devkit monorepo (contributor dev mode), or
    - `^${cliVersion}` when running outside (npm consumer mode).
  - The final generated `package.json` never contains a `workspace:` literal, ensuring `pnpm`, `npm`, and `yarn` can all install it.
  - New environment variable overrides: `DEVKIT_DEP_MODE=link|npm` and `DEVKIT_MONOREPO_ROOT=/path`.
  - `addBundlerToDevDeps` is deprecated in favor of the unified `writeBundlerDevDep` helper that respects the same `IDepMode`.

  **Package versions unified to `0.0.1`**:

  - `@devkit/plugin-vue` previously declared `1.0.0`; now aligned to `0.0.1` to satisfy the lockstep assumption used by template version injection. The next changeset publish will bump every internal package to `0.1.0` together.

  **Release pipeline + contributor docs**:

  - `.changeset/config.json` `baseBranch` fixed from `main` to `master` (matches the GitHub Actions workflow trigger).
  - `.github/workflows/publish-npm.yml` now runs `pnpm test` and `pnpm test:integration` before `changesets/action`, and passes `NPM_TOKEN` as an env var to the action step.
  - New documentation under `packages/devkit-docs/docs/contributing/`:
    - `index.md` — contribution lifecycle overview
    - `setup.md` — local dev environment setup
    - `testing.md` — three-tier test matrix (unit / integration / e2e)
    - `adding-bundler.md` — how to add a new bundler adapter
    - `adding-plugin.md` — how to add a new framework plugin
    - `release.md` — changeset workflow + GitHub Actions secrets configuration
  - `.dumirc.ts` now exposes a 贡献 navigation entry with full sidebar.
  - `docs/guide.md` adds three creation paths (scaffold / existing project / monorepo dev).
  - `docs/guide/cli.md` adds an FAQ section explaining `link:` URI generation and how to bypass it.

  **Auditing**:

  - Every publishable `@devkit/*` package now declares a `files` allowlist so `npm pack` ships only `dist/` (or `templates/` for plugin packages) and never source files / tests.
  - Removed 5 dead files: 4 unused `schema.json` files (one per bundler — `rollup` / `rspack` / `vite` / `webpack`) that were never imported or shipped, and one orphan `h5.html.ejs` template file (no `.devkitrc.ts` / source entry referenced it).

  **Integration tests**:

  - Added `__tests__/integration/cli/cli-create.test.ts` validating that CLI-generated `package.json` files contain `link:` URIs in monorepo mode and `^${cliVersion}` in npm mode, with zero `workspace:` literal residue.

  Migration: Existing projects unaffected. New projects created by the CLI continue to work in monorepo dev mode (秒级 install with link); outside-monorepo creation falls back to `^${cliVersion}` and will work once the next changeset publish ships `@devkit/*` to npm.

- 8cc286d: **BREAKING**: Decouple bundler adapters from `@devkit/service` runtime dependencies.

  - `@devkit/service` no longer lists `@devkit/bundler-*` packages in `dependencies`. They are now declared as optional `peerDependencies`.
  - `@devkit/cli create` writes the chosen `@devkit/bundler-{name}` to the new project's `devDependencies` automatically.
  - `@devkit/cli add` accepts bundler short names (`vite`, `webpack`, `rspack`, `rollup`, `rolldown`), `bundler-<name>`, or full package names; bundlers are installed as `devDependencies`.
  - `@devkit/service` runtime: when a bundler adapter is not installed, the system now prompts the user (TTY) or fails with guidance (non-TTY); `noSave` transient install path is removed. New environment variables: `DEVKIT_NO_PROMPT=1` to suppress prompts in TTY, `DEVKIT_AUTO_INSTALL=1` to auto-install in CI.
  - `@devkit/shared-utils` adds `confirm()` helper and `BUNDLER_PACKAGE_MAP` / `resolveBundlerName()` / `resolveBundlerPackage()` utilities.

  Migration: existing projects upgrading need to either add their chosen bundler to `devDependencies` (recommended), or accept the runtime install prompt the first time `devkit-service` runs.

### Patch Changes

- 9c0890e: Fix `dc create` hang on generator prompt and binary-mirror noise.

  **Root cause**: `pnpm debug` (i.e. `dc create test-app -t react-ts`) appeared to hang indefinitely. The actual cause was a cascade of UX issues:

  1. `@devkit/plugin-react` and `@devkit/plugin-vue` generators blocked on an enquirer prompt ("是否安装 @devkit/request?") that was visually obscured by spinner output
  2. `PackageManager.setBinaryMirrors` / `getMetadata` printed `ERR_INVALID_PROTOCOL` to stderr on every install invocation, adding noise
  3. `PackageManager.install` in a monorepo sub-directory did not pass `--ignore-workspace` to pnpm, making the behavior fragile

  **Fixes**:

  - `@devkit/plugin-react` / `@devkit/plugin-vue` generators: skip interactive prompt when `!process.stdout.isTTY`, `DEVKIT_NO_PROMPT=1`, or `CI=true|1`. Prompts are preserved for the `dc add react/vue` path where interactivity is expected.
  - `@devkit/cli` `CreateApp.tsx` and `creator.ts`: inject `DEVKIT_NO_PROMPT=1` before invoking framework generator so the ink-rendered create flow never blocks on generator stdin.
  - `normalizeDeps` now runs a **second time** after `runGenerator`, ensuring any `workspace:^` entries added by the generator are converted to `link:` (monorepo mode) or `^cliVersion` (npm mode) before the follow-up `installDeps` call.
  - Generator `api.addDependency` calls for `@devkit/request` now use `"workspace:^"` instead of hardcoded `"^1.0.0"`, conforming to the lockstep version convention.
  - `PackageManager.runCommand`: auto-detects pnpm workspace boundary; appends `--ignore-workspace` when `cwd` is inside a monorepo tree but is NOT a workspace member (e.g. a freshly generated project under `packages/devkit-cli/test-app/`).
  - `PackageManager.getMetadata` / `getAuthConfig` / `setBinaryMirrors`: replaced all `console.error` calls with `logger.debug` (only visible when `DEVKIT_DEBUG=1`). Binary mirror probe failures are now fully silent.
  - `Logger.debug`: new method — outputs only when `DEVKIT_DEBUG=1`, otherwise noop.
  - Two new exported helpers from `@devkit/shared-utils`: `findPnpmWorkspaceRoot` and `isPnpmWorkspaceMember`.

  **New tests**: 11 unit tests for workspace detection helpers and generator `shouldSkipPrompt` logic; 2 new integration tests validating prompt-silenced create flow with zero `workspace:^` / `^1.0.0` residue.
