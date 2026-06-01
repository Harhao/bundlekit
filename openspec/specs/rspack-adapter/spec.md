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

### Requirement: Rspack adapter Angular framework branch

When `rawEnvConfig.framework === "angular"`, the Rspack adapter SHALL:

1. Configure SWC builtin loader with `jsc.parser.decorators = true` and `jsc.transform.legacyDecorator = true` and `jsc.transform.decoratorMetadata = true` for `.ts` files.
2. Register the `@ngtools/webpack` `AngularWebpackPlugin` in the plugins list (rspack is webpack-plugin-API-compatible for the hooks `AngularWebpackPlugin` uses).
3. Replace the default SWC script rule for `.ts` with `@ngtools/webpack` loader so AOT template compilation runs.

The dynamic `_require` of `@ngtools/webpack` SHALL be wrapped in `try/catch`; on failure the adapter SHALL emit a logger warning and fall back to plain SWC (decorators only, no AOT — JIT mode at runtime).

#### Scenario: AngularWebpackPlugin registered under rspack

- **WHEN** `framework === "angular"` and `@ngtools/webpack` is installed
- **THEN** the produced Rspack `Configuration.plugins` SHALL contain an `AngularWebpackPlugin` instance
- **AND** SWC parser config SHALL have `decorators: true` and `decoratorMetadata: true`

#### Scenario: ngtools incompatibility falls back to JIT

- **WHEN** `framework === "angular"` is set
- **AND** `AngularWebpackPlugin` registration throws at construction time (rspack hook incompat)
- **THEN** the Rspack adapter SHALL catch the error, emit a logger warning naming the failure
- **AND** the resulting build SHALL still complete with SWC decorators-only (Angular runs in JIT mode at runtime)

### Requirement: Rspack adapter Angular SSR server pass

When `framework === "angular"` and `__isServerPass === true`, the Rspack adapter SHALL set output `library.type` to `commonjs2` (or `module` if `output.formats === "esm"`) and SHALL apply the same Angular plugin / SWC decorator configuration as the client pass.

#### Scenario: Angular SSR server build under rspack

- **WHEN** `bundlekit-service build --bundler rspack` runs against an Angular SSR project
- **THEN** the server pass SHALL emit `dist/server/server.cjs` with `commonjs2` library type
- **AND** `require('dist/server/server.cjs').render(url)` SHALL return `Promise<string>`

