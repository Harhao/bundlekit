## MODIFIED Requirements

### Requirement: Dependency mode resolution
The `create` command SHALL always use npm registry mode for dependency resolution. The `@bundlekit/*` dependencies in the generated `package.json` SHALL use `^cliVersion` format (e.g., `^0.0.1`). The `link:` protocol SHALL NOT be used.

#### Scenario: npm mode used in monorepo
- **WHEN** user runs `bundlekit-cli create my-app` inside a monorepo
- **THEN** the generated `package.json` SHALL contain `@bundlekit/*` dependencies with `^cliVersion` format
- **AND** no `link:` protocol values SHALL appear in any dependency field

#### Scenario: npm mode used outside monorepo
- **WHEN** user runs `bundlekit-cli create my-app` outside any monorepo
- **THEN** the generated `package.json` SHALL contain `@bundlekit/*` dependencies with `^cliVersion` format

#### Scenario: DEVKIT_DEP_MODE=link silently degrades
- **WHEN** environment variable `DEVKIT_DEP_MODE=link` is set
- **AND** user runs `bundlekit-cli create my-app`
- **THEN** the system SHALL use npm registry mode (not link mode)
- **AND** no error or warning SHALL be displayed

#### Scenario: Zero workspace: literals
- **WHEN** the `create` command completes dependency normalization
- **THEN** the generated `package.json` SHALL contain zero `workspace:` literals in any dependency field

## REMOVED Requirements

### Requirement: Monorepo link mode
**Reason**: link mode causes pnpm workspace conflicts and yarn incompatibility. Industry standard CLIs (create-react-app, create-vue, Vite) use npm registry mode exclusively.
**Migration**: Developers who need to debug local packages should use `npm link` or `yarn link` manually after project creation.

### Requirement: DEVKIT_MONOREPO_ROOT environment variable
**Reason**: Only used by link mode to override monorepo root detection. No longer needed.
**Migration**: Remove any `DEVKIT_MONOREPO_ROOT` settings from CI scripts or shell profiles.
