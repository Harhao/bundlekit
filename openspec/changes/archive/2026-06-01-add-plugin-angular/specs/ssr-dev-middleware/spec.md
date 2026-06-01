## ADDED Requirements

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
