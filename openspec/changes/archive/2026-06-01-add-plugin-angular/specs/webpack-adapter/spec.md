## ADDED Requirements

### Requirement: Webpack adapter Angular framework branch

When `(buildConfig as any).framework === "angular"`, the Webpack adapter SHALL register `AngularWebpackPlugin` from `@ngtools/webpack` in the plugins list and SHALL replace the default `ts-loader` script rule with `@ngtools/webpack` loader for `.ts` files. The `AngularWebpackPlugin` constructor SHALL be passed the project's `tsconfig.json` path (resolved against `service.context`). The `resolve.extensions` array SHALL include `.ts` ahead of `.js`. The dynamic require/import SHALL be wrapped in `try/catch`; on failure the adapter SHALL emit a logger warning naming `@ngtools/webpack` and skip the Angular-specific rules / plugins (build continues but Angular won't compile).

#### Scenario: AngularWebpackPlugin registered

- **WHEN** `framework === "angular"` and `@ngtools/webpack` is installed
- **THEN** the produced Webpack `Configuration.plugins` SHALL contain an `AngularWebpackPlugin` instance
- **AND** the `Configuration.module.rules` for `.ts` files SHALL use `@ngtools/webpack` loader (not the default ts-loader)

#### Scenario: ngtools missing degrades with warning

- **WHEN** `framework === "angular"` is set but `@ngtools/webpack` is not installed
- **THEN** the Webpack adapter SHALL emit `logger.warn` naming `@ngtools/webpack`
- **AND** the produced config SHALL omit the Angular plugin and angular-specific script rules

### Requirement: Webpack adapter Angular SSR server pass

When `framework === "angular"` and `__isServerPass === true`, the Webpack adapter SHALL still register `AngularWebpackPlugin` (with the same tsconfig) and SHALL set output `library.type` to `commonjs2` (or `module` if `output.formats === "esm"`) so the produced server bundle exports `render` for the dev SSR middleware / production runtime to require.

#### Scenario: Angular server bundle exports render

- **WHEN** `bundlekit-service build --bundler webpack` runs against an Angular SSR project
- **THEN** `dist/server/server.cjs` SHALL be requireable via `require('dist/server/server.cjs')`
- **AND** the required module SHALL expose a `render(url): Promise<string>` function
