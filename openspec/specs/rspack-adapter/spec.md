# rspack-adapter Specification

## Purpose
TBD - created by archiving change bundler-adapters. Update Purpose after archive.
## Requirements
### Requirement: Transform config from IBuildConfig
The Rspack adapter SHALL convert an `IBuildConfig` object into a valid Rspack `Configuration`, mapping entry, output, resolve, module.rules, and plugins consistently with the Webpack adapter pattern.

#### Scenario: Entry and output mapping
- **WHEN** `IBuildConfig` contains entry and outDir
- **THEN** the Rspack config SHALL contain corresponding `entry` and `output` settings

#### Scenario: Resolve aliases
- **WHEN** `IBuildConfig.resolve.alias` is configured
- **THEN** the Rspack `resolve.alias` SHALL match

### Requirement: Module rules for TypeScript
The Rspack adapter SHALL configure module rules for `.ts`/`.tsx` files using appropriate Rspack loaders, and for assets using Rspack asset handling.

#### Scenario: TypeScript rule configured
- **WHEN** the project contains TypeScript files
- **THEN** Rspack SHALL have a module rule with `test: /\.tsx?$/` and `use: { loader: 'builtin:swc-loader' }`

### Requirement: Dev server configuration
The Rspack adapter SHALL configure `devServer` from `IBuildConfig.devServer`, supporting host, port, https, proxy, and HMR.

#### Scenario: Dev server with proxy
- **WHEN** `IBuildConfig.devServer` contains proxy settings
- **THEN** the Rspack `devServer` config SHALL include the proxy rules

#### Scenario: HMR in development
- **WHEN** mode is development
- **THEN** Rspack devServer SHALL have `hot: true`

### Requirement: HTML generation
The Rspack adapter SHALL include `HtmlRspackPlugin` for HTML template generation, similar to the Webpack adapter.

#### Scenario: HtmlRspackPlugin configured
- **WHEN** the config is generated
- **THEN** the Rspack config plugins SHALL include `HtmlRspackPlugin` with a template path

### Requirement: Rspack adapter integrates tools hook

After `transformConfig` returns the rspack `RspackOptions`, the system SHALL invoke `tools.rspack(config, ctx)` if declared, and pass the resulting (possibly mutated) `RspackOptions` to subsequent steps.

#### Scenario: Hook adds an rspack plugin
- **WHEN** the user declares `tools.rspack` that pushes a custom plugin into `config.plugins`
- **AND** runs `bundlekit-service serve --bundler rspack`
- **THEN** the resulting rspack compiler SHALL include the custom plugin in its plugin list

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

