# @devkit/plugin-vue

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

- fe82e3c: `@devkit/cli` 的 `create` 命令体验优化：

  - **修复**：交互式描述输入框输入字符即跳步的 bug。`CreateApp` 状态机现在使用显式 `descriptionSubmitted` 标志，仅 `onSubmit`（按回车）时推进步骤。
  - **新增**：包管理器选择步骤。在 bundler 选完后、tasks 启动前插入 PM step；默认顺序 `pnpm` > `yarn` > `npm`，未安装的项灰显 `(未安装)` 不可选；新增 `--pm <pnpm|yarn|npm>` 命令行选项与 `DEVKIT_PM` 环境变量旁路（CI 友好）。
  - **新增**：`Done` 视图根据所选 PM 渲染对应启动指令（`pnpm dev` / `yarn dev` / `npm run dev`），并在信息面板显示包管理器信息。
  - **新增**：bundler 列表分层呈现。主菜单只列 `vite` / `webpack` / `rspack` + `更多打包器 →`；选中后切到次级列表 `rollup` / `rolldown` + `← 返回`；`-b` 命令行选项行为不变（任意 5 个均可直接传）。
  - **新增**：`Select` 组件原生支持 `disabled` 项（灰显且键盘导航跳过）与 `onBack` 回调（响应 Esc / Backspace）。
  - **变更（@devkit/plugin-react、@devkit/plugin-vue）**：`template-react-ts` / `template-react-js` / `template-vue3-ts` / `template-vue3-js` 的 `package.json` 模板精简，仅生成 `clean` / `dev` / `build` 三个脚本；删除 `${bundler}:dev` / `${bundler}:prod` 等 bundler 专属别名（与 `dev` / `build` 完全等价的冗余项）。

  迁移：已存在的项目模板不受影响，仅新建项目的 scripts 行为变化。CI 用户可以用 `--pm` 或 `DEVKIT_PM` 跳过 PM 选择步骤。

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

- Updated dependencies [8cc286d]
- Updated dependencies [8cc286d]
- Updated dependencies [9c0890e]
- Updated dependencies [9c0890e]
- Updated dependencies [8cc286d]
  - @devkit/shared-utils@0.1.0
