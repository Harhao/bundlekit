## ADDED Requirements

### Requirement: Rolldown adapter Angular framework branch

When `rawEnvConfig.framework === "angular"`, the Rolldown adapter SHALL dynamically import `@analogjs/vite-plugin-angular` (rollup-API-compatible; rolldown supports the rollup plugin interface) and add the resulting plugin(s) to the `frameworkPlugins` array. The `resolve.extensions` array SHALL include `.ts` ahead of `.js`. Dynamic import failures SHALL be caught and logged via `logger.warn`; the build SHALL continue without the Angular plugin.

The `moduleTypes` map MAY include `".html": "text"` to allow Angular `templateUrl` files to be inlined as strings if the chosen Angular plugin requires it (decision deferred to implementation; align with how `framework === "vue3"` handles `.css` virtual modules in the same adapter).

#### Scenario: Angular rolldown plugin loaded

- **WHEN** `framework === "angular"` and `@analogjs/vite-plugin-angular` is installed
- **THEN** the produced Rolldown `BuildOptions.plugins` array SHALL include the Angular plugin
- **AND** TypeScript decorators in `*.component.ts` SHALL compile without error

#### Scenario: Angular rolldown plugin missing degrades with warning

- **WHEN** `framework === "angular"` is set but `@analogjs/vite-plugin-angular` is not installed
- **THEN** the Rolldown adapter SHALL emit `logger.warn` naming `@analogjs/vite-plugin-angular`
- **AND** the produced Rolldown config SHALL still have CSS / framework-agnostic plugins registered

### Requirement: Rolldown adapter Angular SSR server pass

When `framework === "angular"` and `__isServerPass === true`, the Rolldown adapter SHALL apply the Angular plugin in the server pass and SHALL set `platform: "node"`. The `external` resolver SHALL delegate to `resolveSSRExternals` so `@angular/*` packages declared in project `dependencies` are externalized.

#### Scenario: Angular SSR server bundle under rolldown

- **WHEN** `bundlekit-service build --bundler rolldown` runs against an Angular SSR project with `ssr.externals: "auto"`
- **THEN** the server pass SHALL emit a CommonJS (or ESM if configured) bundle whose `render` named export returns `Promise<string>`
- **AND** the bundle SHALL externalize `@angular/platform-server`
