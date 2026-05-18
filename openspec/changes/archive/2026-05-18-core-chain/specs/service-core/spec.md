## ADDED Requirements

### Requirement: Skip specified plugins
The system SHALL skip loading plugins listed via the `--skip-plugin` CLI option, accepting multiple comma-separated plugin names.

#### Scenario: Skip single plugin
- **WHEN** user runs `devkit-service serve --skip-plugin react`
- **THEN** the `@devkit/plugin-react` plugin SHALL NOT be loaded

#### Scenario: Skip multiple plugins
- **WHEN** user runs `devkit-service serve --skip-plugin react,mock`
- **THEN** both `@devkit/plugin-react` and `@devkit/plugin-mock` SHALL NOT be loaded

### Requirement: Load plugins from config
The system SHALL load additional plugins specified in the `plugins` field of `.devkitrc.ts`, resolving each as a package name or relative path.

#### Scenario: Load project-level plugin
- **WHEN** `.devkitrc.ts` contains `plugins: ["@devkit/plugin-react"]`
- **THEN** the system SHALL resolve and load `@devkit/plugin-react` before starting the build

### Requirement: Resolve bundler adapter
The system SHALL resolve bundler adapters by looking up `@devkit/bundler-{name}` packages, first checking local `node_modules`, then fetching from a remote registry URL with local cache fallback.

#### Scenario: Local bundler found
- **WHEN** `@devkit/bundler-webpack` exists in local `node_modules`
- **THEN** the system SHALL use it directly without fetching from remote

#### Scenario: Remote bundler fallback
- **WHEN** `@devkit/bundler-webpack` is not found locally
- **THEN** the system SHALL fetch the bundler mapping from the remote registry URL, install the package, and load it

### Requirement: Serve command options
The `serve` command SHALL accept `--host`, `--port`, `--https`, `--open`, and `--bundler` options and pass them to the build adapter.

#### Scenario: Custom port and host
- **WHEN** user runs `devkit-service serve --port 3000 --host 0.0.0.0`
- **THEN** the build adapter SHALL receive `port: 3000` and `host: "0.0.0.0"` in its configuration

#### Scenario: Default bundler selection
- **WHEN** user runs `devkit-service serve` without `--bundler`
- **THEN** the system SHALL default to webpack as the bundler
