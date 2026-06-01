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
- **AND** runs `bundlekit-service serve --bundler vite`
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

### Requirement: Vite adapter Angular framework branch

When `envConfig.framework === "angular"`, the Vite adapter SHALL dynamically import `@analogjs/vite-plugin-angular` and add the resulting plugin(s) to the `frameworkPlugins` array, alongside any other configured plugins. The dynamic import SHALL be wrapped in `try/catch`; on failure the adapter SHALL emit a logger warning naming the missing dependency and continue with no Angular plugin loaded (no throw).

#### Scenario: Angular plugin loaded

- **WHEN** the project's `.bundlekitrc.ts` declares `plugins: ["@bundlekit/plugin-angular"]` and `@analogjs/vite-plugin-angular` is installed
- **AND** the user runs `bundlekit-service serve --bundler vite --mode development`
- **THEN** the resolved Vite `InlineConfig.plugins` SHALL include the plugin(s) returned by `@analogjs/vite-plugin-angular`
- **AND** TypeScript decorators in `*.component.ts` files SHALL compile without error

#### Scenario: Angular plugin missing degrades with warning

- **WHEN** `framework === "angular"` is set but `@analogjs/vite-plugin-angular` is not installed in the project
- **THEN** the Vite adapter SHALL emit a `logger.warn` message naming `@analogjs/vite-plugin-angular`
- **AND** the build SHALL continue (other plugins SHALL still register)

### Requirement: Vite adapter Angular SSR build pass

When `envConfig.framework === "angular"` and `__isServerPass === true`, the Vite adapter SHALL produce an `InlineConfig` whose `build.ssr` points to the resolved Angular server entry path and whose `build.rollupOptions.input` resolves to the same. The `@analogjs/vite-plugin-angular` plugin SHALL be applied in both client and server passes.

#### Scenario: Angular SSR server bundle built

- **WHEN** `bundlekit-service build --bundler vite` runs against an Angular SSR project
- **THEN** the server pass SHALL emit a bundle whose default export (or `render` named export) returns `Promise<string>`
- **AND** the client pass SHALL emit a hydratable bundle that imports `provideClientHydration()`-aware `ApplicationConfig`

### Requirement: Vite adapter Angular dev SSR middleware awaits render

When the Vite adapter's `createSSRMiddleware` runs against an Angular SSR project, the middleware SHALL `await server.ssrLoadModule(ssr.entry).render(url)` (i.e. treat the return value as a Promise even when the project uses sync render). The result SHALL replace the configured placeholder in the transformed HTML before responding.

#### Scenario: Async render result substituted

- **WHEN** the user requests `/` from a Vite dev SSR server with `framework === "angular"`
- **AND** `entry-server.ts` exports `async function render(url) { return renderApplication(...); }`
- **THEN** the response body SHALL contain the awaited render output substituted into the HTML
- **AND** no `[object Promise]` literal SHALL appear in the response

