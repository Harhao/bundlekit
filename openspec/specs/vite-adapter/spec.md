# vite-adapter Specification

## Purpose
TBD - created by archiving change core-chain. Update Purpose after archive.
## Requirements
### Requirement: Transform config from IBuildConfig
The Vite adapter SHALL convert an `IBuildConfig` object into a valid Vite `InlineConfig`, replacing all previously hardcoded values with config-driven values.

#### Scenario: Entry resolution
- **WHEN** `IBuildConfig.entry` specifies entry points
- **THEN** Vite's root and entry resolution SHALL be based on `IBuildConfig.entry`

#### Scenario: Output directory
- **WHEN** `IBuildConfig.outDir` is `"dist"`
- **THEN** Vite's `build.outDir` SHALL be `"dist"`

### Requirement: Dev server from config
The Vite adapter SHALL configure the dev server from `IBuildConfig.devServer` and CLI args, including port, host, https, and proxy settings.

#### Scenario: Port and proxy from config
- **WHEN** `IBuildConfig.devServer` contains `{ port: 3000, proxy: { "/api": "http://localhost:4000" } }`
- **THEN** Vite server SHALL listen on port 3000 with the specified proxy

### Requirement: Multi-mode support
The Vite adapter SHALL support all build modes: development, production, gray, test, and staging, configuring Vite appropriately for each.

#### Scenario: Production mode minifies
- **WHEN** mode is production
- **THEN** Vite `build.minify` SHALL be enabled

#### Scenario: Development mode with HMR
- **WHEN** mode is development
- **THEN** Vite SHALL use `createServer()` with HMR enabled

### Requirement: Vite adapter integrates tools hook

After `transformConfig` returns the vite `InlineConfig`, the system SHALL invoke `tools.vite(config, ctx)` if declared, and pass the resulting (possibly mutated) `InlineConfig` to subsequent steps.

#### Scenario: Hook adds a vite plugin
- **WHEN** the user declares `tools.vite` that pushes a custom plugin into `config.plugins`
- **AND** runs `devkit-service serve --bundler vite`
- **THEN** the resulting vite server SHALL include the custom plugin in its plugin list

#### Scenario: Hook tweaks server settings
- **WHEN** the user declares `tools.vite` that mutates `config.server.cors`
- **THEN** the running vite server SHALL reflect the mutated cors setting

### Requirement: Vite adapter SSR build pass

When invoked with `ctx.env === 'server'`, the vite adapter SHALL produce an `InlineConfig` with `build.ssr` set to the resolved server entry, `build.rollupOptions.input` mapped accordingly, and `build.outDir` switched to `ssr.output.dir`.

#### Scenario: Server bundle uses build.ssr
- **WHEN** SSR server pass executes
- **THEN** the vite config SHALL set `build.ssr` to the absolute path of `ssr.entry`
- **AND** `build.outDir` SHALL be the absolute path of `ssr.output.dir`

### Requirement: Vite adapter SSR dev middleware

The vite adapter SHALL implement `createSSRMiddleware(buildConfig, ctx)` to start a vite server in `middlewareMode: true`, expose its `middlewares`, and append a custom SSR handler that calls `server.transformIndexHtml(url, template)` followed by `server.ssrLoadModule(ssr.entry).render(url)`.

#### Scenario: Dev SSR returns hydrated HTML
- **WHEN** SSR dev server is running with bundler=vite
- **AND** the user requests `/` over HTTP
- **THEN** the response SHALL be HTML where `<!--ssr-outlet-->` has been replaced by `render(url)` output
- **AND** the response SHALL include vite's HMR client script for client hydration

#### Scenario: HMR for SSR modules
- **WHEN** the user edits a module that is imported by both client and server
- **THEN** subsequent requests SHALL reflect the change without restarting the dev server
- **AND** the browser SHALL receive an HMR update for the client portion

