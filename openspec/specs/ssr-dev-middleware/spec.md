# ssr-dev-middleware Specification

## Purpose
TBD - created by archiving change add-ssr-support. Update Purpose after archive.
## Requirements
### Requirement: createSSRMiddleware adapter method

The `IBuildToolAdapter` interface SHALL expose an optional method `createSSRMiddleware(buildConfig, ctx): Promise<RequestHandler | RequestHandler[]>`. Adapters that support dev SSR SHALL implement this method to return one or more `connect`-compatible middleware functions.

#### Scenario: Vite adapter exposes middleware
- **WHEN** the system queries `viteAdapter.createSSRMiddleware(buildConfig, ctx)` with SSR enabled
- **THEN** it SHALL return a request handler that uses vite's `ssrLoadModule` and `transformIndexHtml` to render

#### Scenario: Webpack adapter exposes middleware
- **WHEN** the system queries `webpackAdapter.createSSRMiddleware(buildConfig, ctx)` with SSR enabled
- **THEN** it SHALL return an ordered chain that includes `webpack-dev-middleware`, `webpack-hot-middleware`, and a custom SSR handler that requires the latest server bundle

#### Scenario: Adapter without dev SSR support
- **WHEN** an adapter does not implement `createSSRMiddleware`
- **AND** SSR dev mode is requested
- **THEN** the system SHALL fail fast with an error naming the bundler

### Requirement: Service orchestrates SSR HTTP server

When `bundlekit-service serve` runs with SSR enabled, the system SHALL start an HTTP server bound to `devServer.host:devServer.port`, mount the adapter-provided middleware chain, and serve all requests through the SSR pipeline.

#### Scenario: Dev SSR responds with rendered HTML
- **WHEN** SSR dev server is running on port 3000
- **AND** a GET request hits `/`
- **THEN** the response SHALL be a 200 OK with HTML where `<!--ssr-outlet-->` (or configured placeholder) has been replaced by the result of `entry-server.render(url)`

#### Scenario: Dev SSR with vite supports HMR
- **WHEN** SSR dev server is running with bundler=vite
- **AND** the user edits a source file imported by the client
- **THEN** the browser SHALL receive HMR update without full reload

#### Scenario: Dev SSR with webpack/rspack supports client HMR but server reload
- **WHEN** SSR dev server is running with bundler=webpack or bundler=rspack
- **AND** the user edits a source file imported by the server entry
- **THEN** subsequent requests SHALL reflect the edit
- **AND** require cache for the server bundle SHALL be invalidated before re-execution

#### Scenario: Dev SSR with rollup/rolldown has no HMR
- **WHEN** SSR dev server is running with bundler=rollup or bundler=rolldown
- **AND** the user edits a source file
- **THEN** the system SHALL rebuild via watcher and the next request SHALL use the new bundle
- **AND** the response SHALL NOT include HMR runtime injection

### Requirement: HTML template with outlet placeholder

The system SHALL load the HTML template file specified by `ssr.template` (default `public/index.html`), pass it through the bundler's HTML transformation pipeline (e.g. `transformIndexHtml` for vite), and replace the placeholder string (default `<!--ssr-outlet-->`) with the rendered HTML returned by `entry-server.render(url)`.

#### Scenario: Custom placeholder
- **WHEN** `ssr.placeholder = '<!--app-html-->'`
- **AND** the template contains `<!--app-html-->`
- **THEN** the system SHALL replace `<!--app-html-->` with the render result

#### Scenario: Template missing placeholder
- **WHEN** the template file does not contain the configured placeholder
- **THEN** the system SHALL log a warning and append the rendered HTML before `</body>`

### Requirement: SSR error overlay in dev

The dev SSR middleware SHALL handle errors thrown by `entry-server.render` by responding with a 500 status code and an HTML error overlay containing the stack trace.

#### Scenario: render throws error
- **WHEN** `entry-server.render(url)` throws an error
- **THEN** the response status SHALL be 500
- **AND** the response body SHALL include the error stack
- **AND** the dev server SHALL NOT crash

### Requirement: SSR middleware awaits render result

For all bundlers that implement `createSSRMiddleware`, the request handler SHALL treat the result of `entry-server.render(url)` as `string | Promise<string>`. When the result is thenable, the handler SHALL `await` it before substituting the configured `ssr.placeholder` in the HTML template. This requirement makes the existing `string | Promise<string>` artifact contract (declared in `ssr-build`) explicit at the runtime call site, enabling frameworks with async render functions (e.g. Angular's `renderApplication`) to work uniformly across bundlers.

#### Scenario: Async render is awaited

- **WHEN** a bundler's dev SSR middleware invokes `render(url)` and the function returns a `Promise<string>`
- **THEN** the middleware SHALL `await` the promise
- **AND** the resulting string SHALL replace `<!--ssr-outlet-->` (or configured placeholder) in the template
- **AND** the response body SHALL NOT contain `[object Promise]`

#### Scenario: Sync render still works

- **WHEN** a bundler's dev SSR middleware invokes `render(url)` and the function returns a string directly (e.g. React `renderToString`)
- **THEN** the middleware SHALL still substitute the string into the template
- **AND** no observable behavior change SHALL occur for projects using sync render (zero regression for React templates)

#### Scenario: Async render rejection produces 500

- **WHEN** `render(url)` returns a Promise that rejects with an error
- **THEN** the middleware SHALL respond with status `500`
- **AND** the response body SHALL include the error stack
- **AND** the dev server SHALL NOT crash

