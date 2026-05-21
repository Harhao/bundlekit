## MODIFIED Requirements

### Requirement: Configuration validation
The webpack adapter SHALL validate the generated webpack configuration against webpack's JSON schema before returning it, using the original `IBuildConfig` for semantic validation.

#### Scenario: Valid config passes
- **WHEN** a valid webpack configuration is generated
- **THEN** `validateConfig(webpackConfig, buildConfig)` SHALL return `true`

#### Scenario: Invalid config fails
- **WHEN** the generated config has a missing required field
- **THEN** `validateConfig(webpackConfig, buildConfig)` SHALL return `false`

#### Scenario: Validation called with both arguments in run
- **WHEN** `run()` is invoked
- **THEN** `validateConfig` SHALL be called with both the native webpack config and the `IBuildConfig`

## ADDED Requirements

### Requirement: Production build awaits completion
The webpack adapter's production build SHALL complete asynchronously, properly awaiting the webpack compilation and propagating any errors.

#### Scenario: Production build resolves on success
- **WHEN** webpack completes compilation without errors
- **THEN** `run()` SHALL resolve its returned Promise after the build finishes

#### Scenario: Production build rejects on webpack error
- **WHEN** webpack encounters a fatal error during compilation
- **THEN** `run()` SHALL reject its Promise with the error, causing `startBuilder()` to handle it

#### Scenario: Production build rejects on stats errors
- **WHEN** webpack compilation reports `stats.hasErrors() === true`
- **THEN** `run()` SHALL reject its Promise with a descriptive error

### Requirement: IBuildOutput formats supports array
The webpack adapter SHALL accept `IBuildOutput.formats` as either a single `IBuildFormat` string or an array of `IBuildFormat` strings, using the first format for the primary webpack output.

#### Scenario: Single format string accepted
- **WHEN** `output.formats` is `"umd"`
- **THEN** webpack `output.libraryTarget` SHALL be `"umd"`

#### Scenario: Array of formats uses first value
- **WHEN** `output.formats` is `["esm", "commonjs"]`
- **THEN** webpack SHALL use the first format (`"esm"`) for `output.libraryTarget`
