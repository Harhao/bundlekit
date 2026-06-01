# rolldown-adapter Specification

## Purpose
TBD - created by archiving change add-rolldown-adapter. Update Purpose after archive.
## Requirements
### Requirement: Transform config from IBuildConfig
The Rolldown adapter SHALL convert an `IBuildConfig` object into a valid Rolldown `RolldownOptions` configuration, mapping entry, output, resolve, and using Rolldown's built-in transforms for TypeScript/JSX.

#### Scenario: Entry mapping from string
- **WHEN** `IBuildConfig` env config has `entry: "src/index.tsx"` and project root is `/app`
- **THEN** Rolldown `input` SHALL be `{ app: "/app/src/index.tsx" }`

#### Scenario: Entry mapping from object
- **WHEN** `IBuildConfig` env config has `entry: { main: "src/main.ts", h5: "src/h5.ts" }`
- **THEN** Rolldown `input` SHALL contain both entries with resolved absolute paths

### Requirement: Output mapping
The Rolldown adapter SHALL map `IBuildConfig.output` fields to Rolldown output configuration.

#### Scenario: Output directory mapping
- **WHEN** `IBuildConfig` env config has `output: { dir: "dist", formats: "es" }`
- **THEN** Rolldown `output.dir` SHALL be the resolved path and `output.format` SHALL be `"es"`

### Requirement: Dev watch mode
The Rolldown adapter SHALL use Rolldown's watch API in development mode, logging rebuild start, success, and error events.

#### Scenario: Watch mode on file change
- **WHEN** `run()` is called in development mode
- **THEN** `rolldown.watch()` SHALL be invoked and SHALL log rebuild events on file changes

### Requirement: Production build
The Rolldown adapter SHALL use `rolldown.build()` in production mode to produce output files.

#### Scenario: Production build writes output
- **WHEN** `run()` is called in production mode
- **THEN** `rolldown.build()` SHALL produce output files at the configured directory

### Requirement: Built-in TypeScript and JSX transform
The Rolldown adapter SHALL leverage Rolldown's native TypeScript and JSX transform without requiring external loaders.

#### Scenario: TypeScript file compiled
- **WHEN** the project contains `.tsx` files with React JSX
- **THEN** Rolldown SHALL transform them without additional plugin configuration

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

