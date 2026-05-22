---
"@bundlekit/cli": patch
"@bundlekit/plugin-react": patch
"@bundlekit/plugin-vue": patch
"@bundlekit/shared-utils": patch
---

Fix `dc create` hang on generator prompt and binary-mirror noise.

**Root cause**: `pnpm debug` (i.e. `dc create test-app -t react-ts`) appeared to hang indefinitely. The actual cause was a cascade of UX issues:
1. `@bundlekit/plugin-react` and `@bundlekit/plugin-vue` generators blocked on an enquirer prompt ("是否安装 @bundlekit/request?") that was visually obscured by spinner output
2. `PackageManager.setBinaryMirrors` / `getMetadata` printed `ERR_INVALID_PROTOCOL` to stderr on every install invocation, adding noise
3. `PackageManager.install` in a monorepo sub-directory did not pass `--ignore-workspace` to pnpm, making the behavior fragile

**Fixes**:
- `@bundlekit/plugin-react` / `@bundlekit/plugin-vue` generators: skip interactive prompt when `!process.stdout.isTTY`, `DEVKIT_NO_PROMPT=1`, or `CI=true|1`. Prompts are preserved for the `dc add react/vue` path where interactivity is expected.
- `@bundlekit/cli` `CreateApp.tsx` and `creator.ts`: inject `DEVKIT_NO_PROMPT=1` before invoking framework generator so the ink-rendered create flow never blocks on generator stdin.
- `normalizeDeps` now runs a **second time** after `runGenerator`, ensuring any `workspace:^` entries added by the generator are converted to `link:` (monorepo mode) or `^cliVersion` (npm mode) before the follow-up `installDeps` call.
- Generator `api.addDependency` calls for `@bundlekit/request` now use `"workspace:^"` instead of hardcoded `"^1.0.0"`, conforming to the lockstep version convention.
- `PackageManager.runCommand`: auto-detects pnpm workspace boundary; appends `--ignore-workspace` when `cwd` is inside a monorepo tree but is NOT a workspace member (e.g. a freshly generated project under `packages/bundlekit-cli/test-app/`).
- `PackageManager.getMetadata` / `getAuthConfig` / `setBinaryMirrors`: replaced all `console.error` calls with `logger.debug` (only visible when `DEVKIT_DEBUG=1`). Binary mirror probe failures are now fully silent.
- `Logger.debug`: new method — outputs only when `DEVKIT_DEBUG=1`, otherwise noop.
- Two new exported helpers from `@bundlekit/shared-utils`: `findPnpmWorkspaceRoot` and `isPnpmWorkspaceMember`.

**New tests**: 11 unit tests for workspace detection helpers and generator `shouldSkipPrompt` logic; 2 new integration tests validating prompt-silenced create flow with zero `workspace:^` / `^1.0.0` residue.
