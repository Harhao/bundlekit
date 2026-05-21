## ADDED Requirements

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
