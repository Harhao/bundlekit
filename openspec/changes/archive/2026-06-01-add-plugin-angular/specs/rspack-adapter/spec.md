## ADDED Requirements

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
