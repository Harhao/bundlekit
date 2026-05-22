---
"@bundlekit/cli": minor
"@bundlekit/service": minor
"@bundlekit/shared-utils": minor
"@bundlekit/bundler-webpack": minor
"@bundlekit/bundler-vite": minor
"@bundlekit/bundler-rspack": minor
"@bundlekit/bundler-rollup": minor
"@bundlekit/bundler-rolldown": minor
"@bundlekit/plugin-react": minor
"@bundlekit/plugin-vue": minor
"@bundlekit/plugin-mock": minor
"@bundlekit/request": minor
---

Adopt workspace protocol for template dependencies; align package versions; add release pipeline + contributor docs.

**Template dependencies switched to `workspace:^`**:
- All four templates (`react-ts`, `react-js`, `vue3-ts`, `vue3-js`) now declare `@bundlekit/*` internal package dependencies as `workspace:^` in `package.json.ejs`.
- CLI introduces a new `normalizeDeps` step right after template rendering that replaces every `workspace:^` literal with either:
  - `link:/abs/path/to/packages/bundlekit-<name>` when running inside the bundlekit monorepo (contributor dev mode), or
  - `^${cliVersion}` when running outside (npm consumer mode).
- The final generated `package.json` never contains a `workspace:` literal, ensuring `pnpm`, `npm`, and `yarn` can all install it.
- New environment variable overrides: `DEVKIT_DEP_MODE=link|npm` and `DEVKIT_MONOREPO_ROOT=/path`.
- `addBundlerToDevDeps` is deprecated in favor of the unified `writeBundlerDevDep` helper that respects the same `IDepMode`.

**Package versions unified to `0.0.1`**:
- `@bundlekit/plugin-vue` previously declared `1.0.0`; now aligned to `0.0.1` to satisfy the lockstep assumption used by template version injection. The next changeset publish will bump every internal package to `0.1.0` together.

**Release pipeline + contributor docs**:
- `.changeset/config.json` `baseBranch` fixed from `main` to `master` (matches the GitHub Actions workflow trigger).
- `.github/workflows/publish-npm.yml` now runs `pnpm test` and `pnpm test:integration` before `changesets/action`, and passes `NPM_TOKEN` as an env var to the action step.
- New documentation under `packages/bundlekit-docs/docs/contributing/`:
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
- Every publishable `@bundlekit/*` package now declares a `files` allowlist so `npm pack` ships only `dist/` (or `templates/` for plugin packages) and never source files / tests.
- Removed 5 dead files: 4 unused `schema.json` files (one per bundler — `rollup` / `rspack` / `vite` / `webpack`) that were never imported or shipped, and one orphan `h5.html.ejs` template file (no `.bundlekitrc.ts` / source entry referenced it).

**Integration tests**:
- Added `__tests__/integration/cli/cli-create.test.ts` validating that CLI-generated `package.json` files contain `link:` URIs in monorepo mode and `^${cliVersion}` in npm mode, with zero `workspace:` literal residue.

Migration: Existing projects unaffected. New projects created by the CLI continue to work in monorepo dev mode (秒级 install with link); outside-monorepo creation falls back to `^${cliVersion}` and will work once the next changeset publish ships `@bundlekit/*` to npm.
