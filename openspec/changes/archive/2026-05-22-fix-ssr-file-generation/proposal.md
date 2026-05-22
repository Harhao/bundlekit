## Why

The `create` command has two SSR-related bugs:

1. **`entry-client` files are always generated** — The generator only filters `entry-server` files when `ssr=false`, but `entry-client` files (which are only meaningful in SSR mode) are always output. This clutters non-SSR projects with unnecessary files.
2. **No interactive SSR selection** — The `--ssr` flag is the only way to enable SSR. In the Ink interactive flow (TTY), users are never asked whether they want SSR, making the feature effectively invisible.

## What Changes

- **Generator filtering**: When `ssr=false`, skip both `entry-server` and `entry-client` files. When `ssr=true`, skip `index.tsx`/`main.ts` (the CSR-only entry).
- **Ink UI step**: Add an SSR selection step (Yes/No) between the "bundler" and "pm" steps in the interactive create flow.
- **Legacy path**: The non-TTY / enquirer path shall also prompt for SSR when not provided via `--ssr`.
- **Total step count**: Changes from 4 steps to 5 steps in the UI (模板 → 打包器 → SSR → 包管理器 → 描述).

## Capabilities

### Modified Capabilities

- `cli-generator`: The conditional file generation requirement must specify that both `entry-client` and `entry-server` are filtered when `ssr=false`, and the CSR-only entry (`index.tsx`/`main.ts`) is filtered when `ssr=true`.
- `cli-ink-ui`: The step-based create flow must include an SSR selection step (step 3) between bundler and pm.
- `cli-create`: The complete creation flow and the step order must be updated to reflect the new SSR step.

### New Capabilities

- `ssr-file-selection`: Dedicated spec for SSR-conditional file generation rules, covering which files are included/excluded in each mode.

## Impact

- `packages/bundlekit-cli/lib/generator/index.ts` — Update `processDir` filter logic
- `packages/bundlekit-cli/lib/ui/CreateApp.tsx` — Add SSR selection step
- `packages/bundlekit-cli/lib/commands/create/creator.ts` — Add SSR prompt in legacy path
- `packages/bundlekit-cli/index.tsx` — Ensure `--ssr` flag flows correctly
- Existing integration tests in `__tests__/integration/cli/cli-create.test.ts` — Update expected file presence
