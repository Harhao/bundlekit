## 1. Generator fix — SSR file filtering

- [x] 1.1 Update `packages/bundlekit-cli/lib/generator/index.ts` `processDir` method: when `ssr=false`, skip files containing `entry-client` (in addition to existing `entry-server` filter)
- [x] 1.2 Update same method: when `ssr=true`, skip CSR-only entry files (`index.tsx`, `index.jsx`, `main.ts`, `main.js`)
- [x] 1.3 Rebuild CLI: run `pnpm run cli:build` in `packages/bundlekit-cli`

## 2. Ink UI — SSR selection step

- [x] 2.1 Update `packages/bundlekit-cli/lib/ui/CreateApp.tsx`: add `"ssr"` to the Step union type and add SSR selection step (step 3) between bundler and pm with Yes/No options
- [x] 2.2 Update step total from 4 to 5 in all step title bars
- [x] 2.3 Update `packages/bundlekit-cli/lib/commands/create/actions.ts` `ICreateOptions` to ensure `ssr` flows through correctly from params
- [x] 2.4 Update `packages/bundlekit-cli/lib/ui/CreateApp.tsx` task list to include SSR-related task label

## 3. Legacy path — SSR prompt

- [x] 3.1 Update `packages/bundlekit-cli/lib/commands/create/creator.ts` `legacyCreate` or equivalent: add enquirer prompt for SSR when `--ssr` flag is not provided
- [x] 3.2 Ensure `packages/bundlekit-cli/index.tsx` passes `ssr` option correctly in the non-TTY path

## 4. Tests

- [x] 4.1 Update `__tests__/integration/cli/cli-create.test.ts`: adjust expected file presence assertions — non-SSR tests should NOT expect `entry-client`, SSR tests should NOT expect `index.tsx`
- [x] 4.2 Add new test cases for the SSR selection step if feasible (or verify existing tests cover the flag path)

## 5. Rebuild and verify

- [x] 5.1 Run `pnpm run cli:build` and verify dist output
- [x] 5.2 Run `bundlekit-cli version` to confirm no runtime errors
- [x] 5.3 Run integration tests: `pnpm vitest run --config vitest.integration.config.ts __tests__/integration/cli/cli-create`
