## MODIFIED Requirements

### Requirement: Resolve bundler adapter

The system SHALL resolve bundler adapters by `require.resolve`-ing `@bundlekit/bundler-{name}` against the project's `node_modules`. When the package cannot be resolved, the system SHALL NOT silently install it via a transient (`noSave`) path. Instead, the system SHALL invoke the runtime bundler missing prompt flow defined in the `bundler-installation` capability and either install the package as a `devDependency` (after user consent or `DEVKIT_AUTO_INSTALL=1`) or terminate the process with a non-zero exit code.

#### Scenario: Local bundler found
- **WHEN** `@bundlekit/bundler-webpack` is resolvable from the project's `node_modules`
- **THEN** the system SHALL load it directly without any install action

#### Scenario: Bundler missing, user installs
- **WHEN** `@bundlekit/bundler-webpack` is not resolvable
- **AND** the prompt flow obtains user consent (or auto install is enabled)
- **THEN** the system SHALL install `@bundlekit/bundler-webpack` as a `devDependency` of the project, write it to `package.json`, and resume loading the adapter

#### Scenario: Bundler missing, user declines
- **WHEN** `@bundlekit/bundler-webpack` is not resolvable
- **AND** the prompt flow does not obtain consent
- **THEN** the system SHALL print an error including `bundlekit-cli add bundler-webpack` as guidance and exit with a non-zero status code
