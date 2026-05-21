## ADDED Requirements

### Requirement: Rollup adapter SSR build pass

When invoked with `ctx.env === 'server'`, the rollup adapter SHALL produce a `RollupOptions` with `output.format` set from `ssr.output.formats` (typically `'cjs'`), `output.dir` from `ssr.output.dir`, and `external` computed from `ssr.externals`.

#### Scenario: Server bundle CJS output
- **WHEN** `ssr.output.formats === 'commonjs'`
- **THEN** the rollup `output.format` SHALL be `'cjs'`
- **AND** the produced file SHALL be requireable via Node's `require()`

#### Scenario: Auto externals
- **WHEN** `ssr.externals === 'auto'`
- **THEN** the rollup `external` SHALL be a function that returns true for any id resolved under `node_modules`

### Requirement: Rollup adapter SSR dev middleware (no HMR)

The rollup adapter SHALL implement `createSSRMiddleware(buildConfig, ctx)` to start a rollup watcher and return a single SSR handler that, on each request, awaits the latest watcher build, requires the freshest server bundle (clearing require cache), and renders. The middleware SHALL NOT inject HMR runtime.

#### Scenario: Watcher rebuilds on file edit
- **WHEN** SSR dev server is running with bundler=rollup
- **AND** the user edits a file imported by `entry-server.tsx`
- **THEN** the watcher SHALL trigger a rebuild
- **AND** the next HTTP request SHALL receive HTML rendered from the new server bundle

#### Scenario: No HMR client script
- **WHEN** SSR dev server is running with bundler=rollup
- **AND** a client requests HTML
- **THEN** the response SHALL NOT contain HMR-related runtime injection
