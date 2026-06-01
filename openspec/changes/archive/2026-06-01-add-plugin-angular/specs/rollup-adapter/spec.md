## ADDED Requirements

### Requirement: Rollup adapter Angular framework branch

When `rawEnvConfig.framework === "angular"`, the Rollup adapter SHALL dynamically import `@analogjs/vite-plugin-angular` (which is rollup-API-compatible) and add the resulting plugin(s) to the `frameworkPlugins` array, alongside the existing CSS plugin. The `resolve.extensions` array SHALL include `.ts` ahead of `.js`. Dynamic import failures SHALL be caught and logged via `logger.warn`; the build SHALL continue without the Angular plugin (Angular code will likely fail to compile downstream — the warning surfaces the missing dependency to the user).

#### Scenario: Angular rollup plugin loaded

- **WHEN** `framework === "angular"` and `@analogjs/vite-plugin-angular` is installed
- **THEN** the produced Rollup `RollupOptions.plugins` array SHALL include the Angular plugin
- **AND** TypeScript decorators in `*.component.ts` SHALL compile without error

#### Scenario: Angular rollup plugin missing degrades with warning

- **WHEN** `framework === "angular"` is set but `@analogjs/vite-plugin-angular` is not installed
- **THEN** the Rollup adapter SHALL emit `logger.warn` naming `@analogjs/vite-plugin-angular`
- **AND** the produced Rollup config SHALL still have the CSS plugin and other framework-agnostic plugins registered

### Requirement: Rollup adapter Angular SSR server pass

When `framework === "angular"` and `__isServerPass === true`, the Rollup adapter SHALL apply the Angular plugin in the server pass and SHALL set output `format` to `cjs` (or `esm` if `output.formats === "esm"`). The `external` resolver SHALL exclude `@angular/*` packages from being bundled into the server output (delegated to `resolveSSRExternals` "auto" mode + project `package.json` deps).

#### Scenario: Angular SSR server bundle under rollup

- **WHEN** `bundlekit-service build --bundler rollup` runs against an Angular SSR project with `ssr.externals: "auto"`
- **THEN** the server pass SHALL emit `dist/server/server.cjs` whose `render` named export returns `Promise<string>`
- **AND** the bundle SHALL `require('@angular/platform-server')` at runtime (not bundle it inline)
