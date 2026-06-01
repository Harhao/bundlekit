## ADDED Requirements

### Requirement: Plugin registration

The Angular plugin SHALL export a default object satisfying `IRegisterPlugin`, with `apply(api, options)` writing `framework: "angular"` into every entry of `buildConfig.config[env]` and calling `api.modifyBuildConfig`.

#### Scenario: framework field written for development env

- **WHEN** `@bundlekit/plugin-angular` is loaded by the service for an env named `development`
- **THEN** `buildConfig.config.development.framework` SHALL equal `"angular"`
- **AND** `api.modifyBuildConfig(buildConfig)` SHALL be called exactly once

#### Scenario: framework field written for all envs

- **WHEN** `buildConfig.config` contains both `development` and `production` envs
- **THEN** both `buildConfig.config.development.framework` and `buildConfig.config.production.framework` SHALL equal `"angular"`

### Requirement: Plugin generator hook

The Angular plugin SHALL expose `generator/index.ts` exporting a default async `generate(context, api)` function that adds `@bundlekit/plugin-angular` to the project `.bundlekitrc.*` plugins array via `addPluginToConfig`. The generator SHALL be safe in non-TTY / CI environments and SHALL only prompt the user (e.g., for optional `@bundlekit/request` install) when stdin is a TTY and `DEVKIT_NO_PROMPT` / `CI` are not set.

#### Scenario: Plugin added to bundlekitrc

- **WHEN** the cli runs `@bundlekit/plugin-angular/generator` against a freshly created project
- **THEN** the project's `.bundlekitrc.ts` (or `.bundlekitrc.js`) SHALL contain `"@bundlekit/plugin-angular"` in its `plugins` array

#### Scenario: Skip prompt in CI

- **WHEN** `process.env.CI === "true"` is set and the generator runs
- **THEN** the generator SHALL NOT call `api.prompt`
- **AND** the generator SHALL complete without throwing

### Requirement: TypeScript template structure

The Angular plugin SHALL provide a `template-angular-ts` directory containing a working Angular 17+ standalone-component project with the following minimum file set:

- `.bundlekitrc.ts.ejs`
- `package.json.ejs`
- `tsconfig.json` (with `experimentalDecorators` and `emitDecoratorMetadata` enabled, `target: "ES2022"` or higher)
- `public/index.html.ejs` (with `<app-root><!--ssr-outlet--></app-root>`)
- `src/app/app.component.ts.ejs`
- `src/app/app.config.ts.ejs` exporting an `ApplicationConfig`
- `src/main.ts.ejs` (CSR-only entry; calls `bootstrapApplication`)
- `src/entry-client.ts.ejs` (SSR-only client hydration entry)
- `src/entry-server.ts.ejs` (SSR-only server entry; exports async `render(url): Promise<string>` using `renderApplication` from `@angular/platform-server`)

The `tsconfig.json` SHALL declare `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `useDefineForClassFields: false`. The `package.json.ejs` SHALL pin `@angular/core` and `@angular/platform-browser` to `^17.0.0` (CSR), and additionally `@angular/platform-server@^17` plus `zone.js` when SSR is enabled.

#### Scenario: TypeScript SSR template generation

- **WHEN** the user runs `bc create my-app -t angular-ts -b vite --ssr`
- **THEN** the generated project SHALL contain `src/entry-client.ts`, `src/entry-server.ts`, `src/app/app.component.ts`, `src/app/app.config.ts`, `tsconfig.json`, `.bundlekitrc.ts`, `public/index.html`
- **AND** `src/main.ts` SHALL NOT exist
- **AND** `entry-server.ts` SHALL export an async `render(url: string): Promise<string>` function that calls `renderApplication`
- **AND** `package.json` SHALL declare `@angular/platform-server@^17` and `zone.js`
- **AND** `.bundlekitrc.ts` SHALL contain an `ssr` config block referencing `src/entry-server.ts`

#### Scenario: TypeScript CSR template generation

- **WHEN** the user runs `bc create my-app -t angular-ts -b vite` (no `--ssr`)
- **THEN** the generated project SHALL contain `src/main.ts` calling `bootstrapApplication(AppComponent, appConfig)`
- **AND** `src/entry-client.ts` and `src/entry-server.ts` SHALL NOT exist
- **AND** `package.json` SHALL NOT declare `@angular/platform-server`
- **AND** `.bundlekitrc.ts` SHALL NOT contain an `ssr` config block

#### Scenario: tsconfig has decorators enabled

- **WHEN** any `template-angular-ts` project is generated
- **THEN** the generated `tsconfig.json` SHALL set `compilerOptions.experimentalDecorators` to `true`
- **AND** SHALL set `compilerOptions.emitDecoratorMetadata` to `true`

### Requirement: JavaScript template structure

The Angular plugin SHALL provide a `template-angular-js` directory mirroring the structure of `template-angular-ts` but with `.js` source files. Because Angular requires decorators which are not standard JavaScript, the JS template SHALL include a `babel.config.json` (or equivalent) declaring `@babel/plugin-proposal-decorators` (`legacy: true`) and `@babel/plugin-transform-class-properties`. The JS template SHALL omit `tsconfig.json`.

#### Scenario: JavaScript template files

- **WHEN** the user runs `bc create my-app -t angular-js -b vite`
- **THEN** the generated project SHALL contain `src/main.js`, `src/app/app.component.js`, `src/app/app.config.js`, `babel.config.json`, `package.json`, `.bundlekitrc.js`, `public/index.html`
- **AND** the project SHALL NOT contain `tsconfig.json`
- **AND** `package.json` SHALL declare `@babel/core`, `@babel/plugin-proposal-decorators`, `@babel/plugin-transform-class-properties` in `devDependencies`

### Requirement: Zone.js bootstrap import

Generated Angular templates SHALL import `zone.js` as the first statement in the runtime entry file (`main.ts` for CSR, `entry-client.ts` for SSR). Server entry (`entry-server.ts`) SHALL import `zone.js/node` in place of `zone.js`.

#### Scenario: CSR entry imports zone.js

- **WHEN** a `template-angular-ts` CSR project is generated
- **THEN** the first non-comment line of `src/main.ts` SHALL be `import 'zone.js';`

#### Scenario: SSR server entry imports zone.js/node

- **WHEN** a `template-angular-ts` SSR project is generated
- **THEN** the first non-comment line of `src/entry-server.ts` SHALL be `import 'zone.js/node';`

### Requirement: SSR HTML template uses Angular host element

The Angular plugin templates SHALL use `<app-root><!--ssr-outlet--></app-root>` (or the configured `ssr.placeholder`) inside `public/index.html.ejs`, instead of the React/Vue convention of `<div id="root">` / `<div id="app">`.

#### Scenario: SSR template host element

- **WHEN** a `template-angular-ts` SSR project is generated
- **THEN** the generated `public/index.html` SHALL contain a `<app-root>` element wrapping the placeholder
- **AND** the bootstrap call in `entry-client.ts` / `entry-server.ts` SHALL target the `<app-root>` selector
