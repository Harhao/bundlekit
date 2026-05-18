# rspack-adapter Specification

## Purpose
TBD - created by archiving change bundler-adapters. Update Purpose after archive.
## Requirements
### Requirement: Transform config from IBuildConfig
The Rspack adapter SHALL convert an `IBuildConfig` object into a valid Rspack `Configuration`, mapping entry, output, resolve, module.rules, and plugins consistently with the Webpack adapter pattern.

#### Scenario: Entry and output mapping
- **WHEN** `IBuildConfig` contains entry and outDir
- **THEN** the Rspack config SHALL contain corresponding `entry` and `output` settings

#### Scenario: Resolve aliases
- **WHEN** `IBuildConfig.resolve.alias` is configured
- **THEN** the Rspack `resolve.alias` SHALL match

### Requirement: Module rules for TypeScript
The Rspack adapter SHALL configure module rules for `.ts`/`.tsx` files using appropriate Rspack loaders, and for assets using Rspack asset handling.

#### Scenario: TypeScript rule configured
- **WHEN** the project contains TypeScript files
- **THEN** Rspack SHALL have a module rule with `test: /\.tsx?$/` and `use: { loader: 'builtin:swc-loader' }`

### Requirement: Dev server configuration
The Rspack adapter SHALL configure `devServer` from `IBuildConfig.devServer`, supporting host, port, https, proxy, and HMR.

#### Scenario: Dev server with proxy
- **WHEN** `IBuildConfig.devServer` contains proxy settings
- **THEN** the Rspack `devServer` config SHALL include the proxy rules

#### Scenario: HMR in development
- **WHEN** mode is development
- **THEN** Rspack devServer SHALL have `hot: true`

### Requirement: HTML generation
The Rspack adapter SHALL include `HtmlRspackPlugin` for HTML template generation, similar to the Webpack adapter.

#### Scenario: HtmlRspackPlugin configured
- **WHEN** the config is generated
- **THEN** the Rspack config plugins SHALL include `HtmlRspackPlugin` with a template path

