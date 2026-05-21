# @devkit/bundler-rollup

## 0.1.0

### Minor Changes

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

### Patch Changes

- fe82e3c: Add a fixture-driven bundler integration test suite at `__tests__/integration/`.

  **Coverage**:

  - **15 build tests** (5 bundlers × {SPA, Library, SSR}): each spawns `devkit-service build` against an isolated fixture copy, asserts artifacts on disk, and (for SSR) `require()` the produced `server.cjs` to call `render('/')` and assert `__SSR_MARKER__` in the returned HTML
  - **5 dev SSR HTTP tests** (5 bundlers): each spawns `devkit-service serve` with `ssr.dev: true`, performs HTTP GET against a dynamic port via `node fetch`, asserts SSR_MARKER in the response body
  - **1 Playwright HMR test** (vite): launches chromium, navigates to dev SSR server, edits `App.tsx`, asserts text update within 15s. webpack/rspack HMR are scaffolded but currently `test.skip` (needs React Fast Refresh integration; dev SSR HTTP is already covered separately).

  **Infrastructure**:

  - New `vitest.integration.config.ts` separates integration from unit tests (60s timeout, forks pool, max 2 concurrent)
  - New `playwright.config.ts` (chromium-only, sequential)
  - Helpers: `copyFixture`, `spawnService`, `fetchSSR`, `runBuild`, `assertDevSSR`, `assertClientHMR`
  - Fixture isolation: every test copies its source fixture to `__tests__/integration/.tmp/<rand>/` (gitignored), runs `pnpm install --ignore-workspace` (link: protocol references monorepo packages, completes in ~2s)
  - New `package.json` scripts: `test:integration`, `test:e2e`, `test:all`

  **Why this is a patch on bundler/service packages**: the test suite covers but does not change runtime behavior. However it depends on the `createSSRMiddleware` implementations from `add-ssr-support`, which it now backstops with end-to-end coverage.

  Run locally:

  ```sh
  pnpm test:integration         # 15 + 5 = 20 tests in ~20s
  pnpm playwright install chromium && pnpm test:e2e   # 1 passing, 2 skipped
  ```

- Updated dependencies [8cc286d]
- Updated dependencies [8cc286d]
- Updated dependencies [9c0890e]
- Updated dependencies [9c0890e]
- Updated dependencies [8cc286d]
  - @devkit/shared-utils@0.1.0
