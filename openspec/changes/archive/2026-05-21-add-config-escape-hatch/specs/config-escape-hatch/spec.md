## ADDED Requirements

### Requirement: Tools hook field on IBuildConfig

The `IBuildConfig` type SHALL expose an optional `tools` field at the top level. The `tools` field is a record keyed by bundler name (`webpack`, `vite`, `rspack`, `rollup`, `rolldown`); each entry is an optional function that receives the bundler's native config object and a `ToolsCtx` parameter.

#### Scenario: Type declaration shape
- **WHEN** a user authors `.bundlekitrc.ts`
- **THEN** the IDE SHALL accept `tools.webpack` whose first parameter is typed as webpack `Configuration`
- **AND** SHALL accept `tools.vite` whose first parameter is typed as vite `InlineConfig`
- **AND** SHALL accept `tools.rspack`, `tools.rollup`, `tools.rolldown` with their respective native config types

#### Scenario: Optional and partial
- **WHEN** `tools` only declares `webpack`
- **THEN** the configuration SHALL still be valid; missing bundler entries SHALL be treated as no-op

### Requirement: ToolsCtx fields

The `ToolsCtx` parameter passed to every tools hook SHALL contain `mode: IBuildEnv`, `command: 'serve' | 'build'`, `env: 'client' | 'server'`, and `bundler: IBundlerName`.

#### Scenario: Mode and command propagation
- **WHEN** the user runs `bundlekit-service build --bundler webpack --mode production`
- **AND** `tools.webpack` is declared
- **THEN** the hook SHALL be invoked with `ctx.mode === 'production'` and `ctx.command === 'build'`

#### Scenario: env defaults to client
- **WHEN** SSR is not enabled (no `ssr` field present)
- **THEN** `ctx.env` SHALL be `'client'` for every tools hook invocation

### Requirement: Tools hook invocation order

The system SHALL invoke `tools[bundler]` after the bundler adapter's `transformConfig` returns and before `changeConfigure` is invoked. Both hooks operate on the bundler's native config object.

#### Scenario: Ordering
- **WHEN** both `tools.webpack` and `changeConfigure` are declared
- **THEN** the system SHALL call them in this order: `transformConfig` → `tools.webpack` → `changeConfigure` → `run`

#### Scenario: Mutation accepted
- **WHEN** `tools.webpack` mutates the passed `config` and returns `undefined`
- **THEN** the mutated `config` SHALL be passed to `changeConfigure`

#### Scenario: Returned object replaces config
- **WHEN** `tools.webpack` returns a new config object
- **THEN** that returned object SHALL replace the original and be passed to `changeConfigure`

### Requirement: Errors thrown by hooks bubble up

The system SHALL NOT swallow exceptions thrown by tools hooks. Any thrown error SHALL be logged via `Logger.error` and SHALL propagate to terminate the build with a non-zero exit code.

#### Scenario: Hook throws synchronously
- **WHEN** `tools.webpack` throws an error
- **THEN** the system SHALL log the error and exit with a non-zero status code

#### Scenario: Hook returns rejected promise
- **WHEN** `tools.webpack` returns a rejected promise
- **THEN** the system SHALL await it, log the rejection reason, and exit non-zero

### Requirement: shared-utils does not require bundler packages at runtime

The `@bundlekit/shared-utils` package SHALL only `import type` from bundler packages (webpack, vite, rspack, rollup, rolldown) for the purpose of typing the `tools` field. It SHALL NOT add any of these packages to its runtime `dependencies`.

#### Scenario: Inspect shared-utils manifest
- **WHEN** inspecting the published `@bundlekit/shared-utils` package's `package.json`
- **THEN** the `dependencies` object SHALL NOT contain `webpack`, `vite`, `@rspack/core`, `rollup`, or `rolldown`

#### Scenario: Type fallback when bundler missing
- **WHEN** a user does not have `webpack` installed in their workspace
- **THEN** the `tools.webpack` parameter type SHALL gracefully fall back to a permissive type (e.g. `any` or `unknown`) without producing a TypeScript error in `.bundlekitrc.ts`
