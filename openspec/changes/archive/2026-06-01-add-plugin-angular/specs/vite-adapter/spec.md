## ADDED Requirements

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
