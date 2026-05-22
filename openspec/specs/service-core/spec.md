# service-core Specification

## Purpose
TBD - created by archiving change core-chain. Update Purpose after archive.
## Requirements
### Requirement: Skip specified plugins
The system SHALL skip loading plugins listed via the `--skip-plugin` CLI option, accepting multiple comma-separated plugin names.

#### Scenario: Skip single plugin
- **WHEN** user runs `bundlekit-service serve --skip-plugin react`
- **THEN** the `@bundlekit/plugin-react` plugin SHALL NOT be loaded

#### Scenario: Skip multiple plugins
- **WHEN** user runs `bundlekit-service serve --skip-plugin react,mock`
- **THEN** both `@bundlekit/plugin-react` and `@bundlekit/plugin-mock` SHALL NOT be loaded

### Requirement: Load plugins from config
The system SHALL load additional plugins specified in the `plugins` field of `.bundlekitrc.ts`, resolving each as a package name or relative path.

#### Scenario: Load project-level plugin
- **WHEN** `.bundlekitrc.ts` contains `plugins: ["@bundlekit/plugin-react"]`
- **THEN** the system SHALL resolve and load `@bundlekit/plugin-react` before starting the build

### Requirement: Resolve bundler adapter

The system SHALL resolve bundler adapters by `require.resolve`-ing `@bundlekit/bundler-{name}` against the project's `node_modules`. When SSR is enabled, the system SHALL execute the bundler adapter twice in sequence (client pass, then server pass), constructing distinct `IBuildConfig` views and `ToolsCtx` payloads for each pass. When the package cannot be resolved, the system SHALL invoke the runtime bundler missing prompt flow defined in the `bundler-installation` capability and either install the package as a `devDependency` (after user consent or `DEVKIT_AUTO_INSTALL=1`) or terminate the process with a non-zero exit code.

#### Scenario: Local bundler found
- **WHEN** `@bundlekit/bundler-webpack` is resolvable from the project's `node_modules`
- **THEN** the system SHALL load it directly without any install action

#### Scenario: SSR enabled, dual pass
- **WHEN** `envConfig.ssr` is set
- **AND** the bundler adapter is resolvable
- **THEN** the system SHALL invoke `transformConfig` and `run` twice — first with `ctx.env = 'client'` (using existing envConfig output), then with `ctx.env = 'server'` (using ssr.* overrides)
- **AND** server pass failures SHALL halt the orchestration even if client pass succeeded

#### Scenario: Bundler missing, user installs
- **WHEN** `@bundlekit/bundler-webpack` is not resolvable
- **AND** the prompt flow obtains user consent (or auto install is enabled)
- **THEN** the system SHALL install `@bundlekit/bundler-webpack` as a `devDependency` of the project, write it to `package.json`, and resume loading the adapter

#### Scenario: Bundler missing, user declines
- **WHEN** `@bundlekit/bundler-webpack` is not resolvable
- **AND** the prompt flow does not obtain consent
- **THEN** the system SHALL print an error including `bundlekit-cli add bundler-webpack` as guidance and exit with a non-zero status code

### Requirement: Serve command options
The `serve` command SHALL accept `--host`, `--port`, `--https`, `--open`, and `--bundler` options and pass them to the build adapter.

#### Scenario: Custom port and host
- **WHEN** user runs `bundlekit-service serve --port 3000 --host 0.0.0.0`
- **THEN** the build adapter SHALL receive `port: 3000` and `host: "0.0.0.0"` in its configuration

#### Scenario: Default bundler selection
- **WHEN** user runs `bundlekit-service serve` without `--bundler`
- **THEN** the system SHALL default to webpack as the bundler

### Requirement: Plugin apply receives latest config
The system SHALL ensure each plugin's `apply` function receives the most up-to-date `IBuildConfig` at the time of its invocation, reflecting modifications made by previously applied plugins.

#### Scenario: Sequential plugin config modification
- **WHEN** plugin A calls `api.modifyBuildConfig()` to change `framework` to `"react"` during its apply
- **THEN** plugin B applied after A SHALL receive a config where `framework` is `"react"`

#### Scenario: Plugin receives current service config
- **WHEN** any plugin's `apply` function is invoked
- **THEN** the second argument SHALL be `service.getBuildConfig()` at that point in time, not a snapshot from before the loop

### Requirement: validateConfig calls validateBuildConfig
The webpack adapter SHALL call `validateBuildConfig` with both the native webpack config and the original `IBuildConfig` when `run()` is invoked.

#### Scenario: Validation runs with full context
- **WHEN** `WebpackBundler.run()` is called
- **THEN** `this.validateConfig(webpackConfig, buildConfig)` SHALL be invoked with both arguments, causing `validateBuildConfig` to execute its validation logic

