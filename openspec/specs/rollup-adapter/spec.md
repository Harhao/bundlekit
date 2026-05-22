# rollup-adapter Specification

## Purpose
TBD - created by archiving change bundler-adapters. Update Purpose after archive.
## Requirements
### Requirement: Transform config from IBuildConfig
The Rollup adapter SHALL convert an `IBuildConfig` object into a valid Rollup `RollupOptions` configuration, including input, output (UMD format), resolve extensions and aliases, and plugins.

#### Scenario: Complete config transformation
- **WHEN** `IBuildConfig` contains entry, outDir, resolve.extension, and resolve.alias
- **THEN** the generated Rollup config SHALL contain corresponding `input`, `output.dir`, `output.format: "umd"`, and `resolve` settings

### Requirement: Production build produces output
The Rollup adapter SHALL call `bundle.write()` after `rollup.rollup()` in production mode, producing output files at the configured directory.

#### Scenario: Production build writes files
- **WHEN** `run()` is called in production mode
- **THEN** output files SHALL be written to the configured `outDir`

### Requirement: Watch mode for development
The Rollup adapter SHALL use `rollup.watch()` in development mode with proper error and rebuild logging.

#### Scenario: Watch mode updates on file change
- **WHEN** `run()` is called in development mode
- **THEN** `rollup.watch()` SHALL be called and SHALL log rebuild status on file changes

### Requirement: Plugin configuration
The Rollup adapter SHALL include standard plugins: `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`, `@rollup/plugin-typescript`, and `@rollup/plugin-babel`.

#### Scenario: Standard plugins present
- **WHEN** the config is generated
- **THEN** node-resolve, commonjs, typescript, and babel plugins SHALL be included in the Rollup config

### Requirement: Rollup adapter integrates tools hook

After `transformConfig` returns the rollup `RollupOptions`, the system SHALL invoke `tools.rollup(config, ctx)` if declared, and pass the resulting (possibly mutated) `RollupOptions` to subsequent steps.

#### Scenario: Hook adds a rollup plugin
- **WHEN** the user declares `tools.rollup` that pushes a custom plugin into `config.plugins`
- **AND** runs `bundlekit-service build --bundler rollup`
- **THEN** the resulting rollup pipeline SHALL include the custom plugin in its plugin list

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

