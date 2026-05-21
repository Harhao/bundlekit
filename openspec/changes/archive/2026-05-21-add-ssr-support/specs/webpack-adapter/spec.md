## ADDED Requirements

### Requirement: Webpack adapter SSR build pass

When invoked with `ctx.env === 'server'`, the webpack adapter SHALL produce a `Configuration` with `target: 'node'`, `output.libraryTarget: 'commonjs2'`, and externals computed from `ssr.externals`.

#### Scenario: Server bundle with auto externals
- **WHEN** `ssr.externals === 'auto'`
- **THEN** the webpack `externals` SHALL be configured via `webpack-node-externals` (or equivalent), excluding all packages under `node_modules`

#### Scenario: Server bundle output format
- **WHEN** `ssr.output.formats === 'commonjs'`
- **THEN** the webpack `output.libraryTarget` SHALL be `'commonjs2'`
- **AND** the produced file SHALL be requireable via Node's `require()`

### Requirement: Webpack adapter SSR dev middleware

The webpack adapter SHALL implement `createSSRMiddleware(buildConfig, ctx)` to return an ordered chain of `[webpack-dev-middleware, webpack-hot-middleware, ssrHandler]` for the client compilation, plus a watcher for the server compilation that invalidates the require cache and re-executes `entry-server.render` on each request.

#### Scenario: Dev middleware chain present
- **WHEN** `webpackAdapter.createSSRMiddleware(buildConfig, ctx)` is invoked
- **THEN** the returned chain SHALL include `webpack-dev-middleware` before `webpack-hot-middleware` before the SSR handler

#### Scenario: Server bundle re-evaluated per request
- **WHEN** the user edits a file imported by `entry-server.tsx`
- **AND** the watcher rebuilds the server bundle
- **AND** a new request arrives
- **THEN** the SSR handler SHALL clear the server bundle's require cache entry and re-execute `render`
