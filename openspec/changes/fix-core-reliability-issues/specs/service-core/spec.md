## MODIFIED Requirements

### Requirement: Resolve bundler adapter
The system SHALL resolve bundler adapters by looking up `@devkit/bundler-{name}` packages via a typed registry mapping `IBuildTools` keys to package name strings, first checking local `node_modules`, then fetching from a remote registry URL with local cache fallback.

#### Scenario: Local bundler found
- **WHEN** `@devkit/bundler-webpack` exists in local `node_modules`
- **THEN** the system SHALL use it directly without fetching from remote

#### Scenario: Remote bundler fallback
- **WHEN** `@devkit/bundler-webpack` is not found locally
- **THEN** the system SHALL fetch the bundler mapping from the remote registry URL, install the package, and load it

#### Scenario: Registry returns typed mapping
- **WHEN** `getBundlerRegistry()` is called
- **THEN** the return value SHALL be typed as `Record<IBuildTools, string>` and contain entries for all five bundlers

### Requirement: Plugin apply receives latest config
The system SHALL ensure each plugin's `apply` function receives the most up-to-date `IBuildConfig` at the time of its invocation, reflecting modifications made by previously applied plugins.

#### Scenario: Sequential plugin config modification
- **WHEN** plugin A calls `api.modifyBuildConfig()` to change `framework` to `"react"` during its apply
- **THEN** plugin B applied after A SHALL receive a config where `framework` is `"react"`

#### Scenario: Plugin receives current service config
- **WHEN** any plugin's `apply` function is invoked
- **THEN** the second argument SHALL be `service.getBuildConfig()` at that point in time, not a snapshot from before the loop

## ADDED Requirements

### Requirement: validateConfig calls validateBuildConfig
The webpack adapter SHALL call `validateBuildConfig` with both the native webpack config and the original `IBuildConfig` when `run()` is invoked.

#### Scenario: Validation runs with full context
- **WHEN** `WebpackBundler.run()` is called
- **THEN** `this.validateConfig(webpackConfig, buildConfig)` SHALL be invoked with both arguments, causing `validateBuildConfig` to execute its validation logic
