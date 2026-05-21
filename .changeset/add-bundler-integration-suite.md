---
"@devkit/service": patch
"@devkit/bundler-webpack": patch
"@devkit/bundler-vite": patch
"@devkit/bundler-rspack": patch
"@devkit/bundler-rollup": patch
"@devkit/bundler-rolldown": patch
---

Add a fixture-driven bundler integration test suite at `__tests__/integration/`.

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
