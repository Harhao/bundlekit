# vite-adapter Specification

## Purpose
TBD - created by archiving change core-chain. Update Purpose after archive.
## Requirements
### Requirement: Transform config from IBuildConfig
The Vite adapter SHALL convert an `IBuildConfig` object into a valid Vite `InlineConfig`, replacing all previously hardcoded values with config-driven values.

#### Scenario: Entry resolution
- **WHEN** `IBuildConfig.entry` specifies entry points
- **THEN** Vite's root and entry resolution SHALL be based on `IBuildConfig.entry`

#### Scenario: Output directory
- **WHEN** `IBuildConfig.outDir` is `"dist"`
- **THEN** Vite's `build.outDir` SHALL be `"dist"`

### Requirement: Dev server from config
The Vite adapter SHALL configure the dev server from `IBuildConfig.devServer` and CLI args, including port, host, https, and proxy settings.

#### Scenario: Port and proxy from config
- **WHEN** `IBuildConfig.devServer` contains `{ port: 3000, proxy: { "/api": "http://localhost:4000" } }`
- **THEN** Vite server SHALL listen on port 3000 with the specified proxy

### Requirement: Multi-mode support
The Vite adapter SHALL support all build modes: development, production, gray, test, and staging, configuring Vite appropriately for each.

#### Scenario: Production mode minifies
- **WHEN** mode is production
- **THEN** Vite `build.minify` SHALL be enabled

#### Scenario: Development mode with HMR
- **WHEN** mode is development
- **THEN** Vite SHALL use `createServer()` with HMR enabled

