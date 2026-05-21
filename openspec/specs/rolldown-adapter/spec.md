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

