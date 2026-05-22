# bundler-installation Specification

## Purpose
TBD - created by archiving change refactor-bundler-deps. Update Purpose after archive.
## Requirements
### Requirement: Bundler installation entry points

The system SHALL expose two cli entry points to manage bundler adapter installation: `bundlekit-cli create -b <bundler>` for new projects and `bundlekit-cli add bundler-<bundler>` (or `bundlekit-cli add <bundler>` for known bundler names) for existing projects.

#### Scenario: Install bundler during create
- **WHEN** user runs `bundlekit-cli create my-app -b vite`
- **THEN** the generated `my-app/package.json` SHALL include `@bundlekit/bundler-vite` in `devDependencies`
- **AND** `pnpm install` (or detected pm) SHALL install it together with other devDependencies

#### Scenario: Install bundler in existing project (full name)
- **WHEN** user runs `bundlekit-cli add bundler-rspack` in a project root
- **THEN** the system SHALL install `@bundlekit/bundler-rspack` as a `devDependency` of that project

#### Scenario: Install bundler in existing project (short alias)
- **WHEN** user runs `bundlekit-cli add rspack` in a project root
- **AND** `rspack` matches a known bundler in the bundler map
- **THEN** the system SHALL install `@bundlekit/bundler-rspack` as a `devDependency`

### Requirement: Runtime bundler missing prompt

When `bundlekit-service` cannot resolve the active `@bundlekit/bundler-{name}` package via `require.resolve`, the system SHALL prompt the user to install it before proceeding.

#### Scenario: Interactive TTY confirmation, accepted
- **WHEN** the active bundler package is not resolvable
- **AND** `process.stdout.isTTY` is true
- **AND** environment variable `DEVKIT_NO_PROMPT` is not set
- **THEN** the system SHALL display "未安装 @bundlekit/bundler-<name>，是否现在安装? (Y/n)"
- **AND** if the user answers yes, the system SHALL install the package as a `devDependency` of the current project, then continue the build
- **AND** the installed package SHALL be persisted to `package.json`

#### Scenario: Interactive TTY confirmation, declined
- **WHEN** the active bundler package is not resolvable
- **AND** the user answers no to the install prompt
- **THEN** the system SHALL print an error message including the package name and the suggested command (`bundlekit-cli add bundler-<name>`)
- **AND** exit with a non-zero status code

#### Scenario: Non-TTY environment without auto install
- **WHEN** the active bundler package is not resolvable
- **AND** `process.stdout.isTTY` is false (CI / piped)
- **AND** environment variable `DEVKIT_AUTO_INSTALL` is not set to `1`
- **THEN** the system SHALL NOT prompt
- **AND** SHALL print an error and exit with a non-zero status code

#### Scenario: Non-TTY environment with auto install opt-in
- **WHEN** the active bundler package is not resolvable
- **AND** `process.stdout.isTTY` is false
- **AND** environment variable `DEVKIT_AUTO_INSTALL` equals `1`
- **THEN** the system SHALL install the package as a `devDependency` without prompting and continue the build

#### Scenario: Persisted to devDependencies
- **WHEN** the system installs a missing bundler via the prompt or auto install
- **THEN** the project `package.json` SHALL contain the installed `@bundlekit/bundler-<name>` under `devDependencies` (not `dependencies`, not transient)

### Requirement: Service does not depend on bundler adapters

The published `@bundlekit/service` package SHALL NOT list any `@bundlekit/bundler-*` package in its `dependencies` field. It MAY declare them as `peerDependencies` with `peerDependenciesMeta.<name>.optional = true`.

#### Scenario: Inspect published manifest
- **WHEN** inspecting the published `@bundlekit/service` package's `package.json`
- **THEN** the `dependencies` object SHALL NOT contain any key starting with `@bundlekit/bundler-`

#### Scenario: Workspace development still works
- **WHEN** a developer runs `pnpm install` at the monorepo root
- **THEN** `@bundlekit/service` SHALL still resolve sibling `@bundlekit/bundler-*` packages via workspace links during dev / build

