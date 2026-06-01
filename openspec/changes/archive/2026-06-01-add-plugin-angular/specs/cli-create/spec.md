## ADDED Requirements

### Requirement: Angular template available in create command

The `create` command SHALL accept `angular-ts` and `angular-js` as `--template` values, and SHALL accept `angular` as a short alias resolving to `angular-ts`. The interactive `<SelectInput>` SHALL list `Angular + TypeScript` (value `angular-ts`) and `Angular + JavaScript` (value `angular-js`) in the template selection step. `resolvePluginPkgName` SHALL return `"@bundlekit/plugin-angular"` for any normalized template starting with `angular`.

#### Scenario: Template specified via flag

- **WHEN** user runs `bc create my-app --template angular-ts`
- **THEN** the system SHALL resolve `@bundlekit/plugin-angular` as the framework plugin package
- **AND** the templates SHALL be loaded from `@bundlekit/plugin-angular/templates/template-angular-ts/`

#### Scenario: Short alias

- **WHEN** user runs `bc create my-app --template angular`
- **THEN** `normalizeTemplate("angular")` SHALL return `"angular-ts"`
- **AND** the `angular-ts` template SHALL be used

#### Scenario: Interactive list shows Angular options

- **WHEN** the user reaches the template step in a TTY without `--template` flag
- **THEN** the rendered list SHALL contain `Angular + TypeScript` and `Angular + JavaScript` options
- **AND** selecting `Angular + TypeScript` SHALL proceed with `angular-ts`

#### Scenario: Unsupported template name still rejects

- **WHEN** user runs `bc create my-app --template angular-xyz`
- **THEN** the system SHALL throw an error message naming the available templates including `angular-ts` and `angular-js`

### Requirement: Angular SSR creation flow

The `create` command flow with `--template angular-ts --ssr` SHALL produce an Angular SSR project skeleton, including `src/entry-client.ts`, `src/entry-server.ts`, `src/app/app.component.ts`, `src/app/app.config.ts`, and a `.bundlekitrc.ts` containing the `ssr` config block.

#### Scenario: Full Angular SSR creation flow

- **WHEN** user runs `bc create my-app -t angular-ts -b vite --ssr --pm pnpm`
- **THEN** files SHALL be generated in `./my-app`
- **AND** `entry-client.ts`, `entry-server.ts`, `src/app/app.component.ts`, `src/app/app.config.ts` SHALL be present
- **AND** `src/main.ts` SHALL NOT be present
- **AND** `.bundlekitrc.ts` SHALL contain the `ssr` config block
- **AND** `package.json` SHALL declare `@angular/core`, `@angular/platform-browser`, `@angular/platform-server`, `zone.js` in `dependencies`

#### Scenario: Full Angular CSR creation flow

- **WHEN** user runs `bc create my-app -t angular-ts -b vite --pm pnpm`
- **THEN** files SHALL be generated in `./my-app`
- **AND** `src/main.ts` SHALL be present
- **AND** `entry-client.ts` and `entry-server.ts` SHALL NOT be present
- **AND** `.bundlekitrc.ts` SHALL NOT contain the `ssr` config block
- **AND** `package.json` SHALL NOT declare `@angular/platform-server`
