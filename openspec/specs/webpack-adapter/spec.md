# webpack-adapter Specification

## Purpose
TBD - created by archiving change core-chain. Update Purpose after archive.
## Requirements
### Requirement: Transform config from IBuildConfig
The `TransformConfig` class SHALL convert an `IBuildConfig` object into a valid webpack 5 `Configuration` object, mapping entry, output, resolve, module rules, and plugins.

#### Scenario: Entry mapping
- **WHEN** `IBuildConfig.entry` is `{ app: "src/index.ts" }` and project root is `/app`
- **THEN** the webpack `entry` SHALL be `{ app: "/app/src/index.ts" }`

#### Scenario: Output mapping
- **WHEN** `IBuildConfig.outDir` is `"dist"` and project root is `/app`
- **THEN** the webpack `output.path` SHALL be `/app/dist` and `output.libraryTarget` SHALL be `"umd"`

### Requirement: Dev server configuration
The webpack adapter SHALL configure `devServer` from `IBuildConfig.devServer`, including port, host, https, and proxy settings.

#### Scenario: Proxy configuration
- **WHEN** `IBuildConfig.devServer.proxy` contains `{ "/api": "http://localhost:4000" }`
- **THEN** the webpack `devServer.proxy` SHALL contain the corresponding proxy rule

#### Scenario: HMR enabled by default
- **WHEN** mode is development
- **THEN** webpack `devServer.hot` SHALL be `true`

### Requirement: Module rules for TypeScript and assets
The webpack adapter SHALL configure module rules for `.ts`/`.tsx` files using `thread-loader` + `ts-loader`, and for image/font/asset files using webpack 5 asset modules.

#### Scenario: TypeScript processing
- **WHEN** the project contains `.ts` or `.tsx` files
- **THEN** webpack SHALL process them through `thread-loader` and `ts-loader`

### Requirement: Configuration validation
The webpack adapter SHALL validate the generated webpack configuration against webpack's JSON schema before returning it, using the original `IBuildConfig` for semantic validation.

#### Scenario: Valid config passes
- **WHEN** a valid webpack configuration is generated
- **THEN** `validateConfig(webpackConfig, buildConfig)` SHALL return `true`

#### Scenario: Invalid config fails
- **WHEN** the generated config has a missing required field
- **THEN** `validateConfig(webpackConfig, buildConfig)` SHALL return `false`

#### Scenario: Validation called with both arguments in run
- **WHEN** `run()` is invoked
- **THEN** `validateConfig` SHALL be called with both the native webpack config and the `IBuildConfig`

### Requirement: Webpack adapter integrates tools hook

After `transformConfig` returns the webpack `Configuration` object, the system SHALL invoke `tools.webpack(config, ctx)` if declared, and pass the resulting (possibly mutated) `Configuration` to subsequent steps.

#### Scenario: Hook adds a webpack plugin
- **WHEN** the user declares `tools.webpack` that pushes a custom plugin into `config.plugins`
- **AND** runs `bundlekit-service serve --bundler webpack`
- **THEN** the resulting webpack compiler SHALL include the custom plugin in its plugin list

#### Scenario: Hook replaces config object
- **WHEN** the user declares `tools.webpack` that returns a brand-new `Configuration`
- **THEN** the returned configuration SHALL be used by webpack-dev-server / webpack compiler instead of the original

### Requirement: Production build awaits completion
The webpack adapter's production build SHALL complete asynchronously, properly awaiting the webpack compilation and propagating any errors.

#### Scenario: Production build resolves on success
- **WHEN** webpack completes compilation without errors
- **THEN** `run()` SHALL resolve its returned Promise after the build finishes

#### Scenario: Production build rejects on webpack error
- **WHEN** webpack encounters a fatal error during compilation
- **THEN** `run()` SHALL reject its Promise with the error, causing `startBuilder()` to handle it

#### Scenario: Production build rejects on stats errors
- **WHEN** webpack compilation reports `stats.hasErrors() === true`
- **THEN** `run()` SHALL reject its Promise with a descriptive error

### Requirement: IBuildOutput formats supports array
The webpack adapter SHALL accept `IBuildOutput.formats` as either a single `IBuildFormat` string or an array of `IBuildFormat` strings, using the first format for the primary webpack output.

#### Scenario: Single format string accepted
- **WHEN** `output.formats` is `"umd"`
- **THEN** webpack `output.libraryTarget` SHALL be `"umd"`

#### Scenario: Array of formats uses first value
- **WHEN** `output.formats` is `["esm", "commonjs"]`
- **THEN** webpack SHALL use the first format (`"esm"`) for `output.libraryTarget`

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

