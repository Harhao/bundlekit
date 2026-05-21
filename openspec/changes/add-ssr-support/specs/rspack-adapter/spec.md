## ADDED Requirements

### Requirement: Rspack adapter SSR build pass

When invoked with `ctx.env === 'server'`, the rspack adapter SHALL produce an `RspackOptions` with `target: 'node'`, `output.libraryTarget: 'commonjs2'`, and externals computed from `ssr.externals`. The behavior SHALL mirror the webpack adapter.

#### Scenario: Server bundle with auto externals
- **WHEN** `ssr.externals === 'auto'`
- **THEN** the rspack `externals` SHALL exclude all packages under `node_modules`

#### Scenario: Server bundle output format
- **WHEN** `ssr.output.formats === 'commonjs'`
- **THEN** the rspack `output.libraryTarget` SHALL be `'commonjs2'`

### Requirement: Rspack adapter SSR dev middleware

The rspack adapter SHALL implement `createSSRMiddleware(buildConfig, ctx)` using `@rspack/dev-server` middleware mode, returning the dev server middleware chain plus an SSR handler for server bundle execution. Behavior SHALL mirror the webpack adapter.

#### Scenario: Dev middleware chain present
- **WHEN** `rspackAdapter.createSSRMiddleware(buildConfig, ctx)` is invoked
- **THEN** the returned chain SHALL include rspack dev server middleware followed by an SSR handler that re-executes the server bundle on each request after invalidating its require cache
