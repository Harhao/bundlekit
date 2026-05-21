## ADDED Requirements

### Requirement: PackageManager auto-detects workspace boundary
The shared `PackageManager.runCommand` (and downstream `install` / `add`) SHALL detect whether the current working directory sits inside a `pnpm-workspace.yaml` tree but is NOT a workspace member. In that case, the command line passed to `pnpm` SHALL include `--ignore-workspace` so that pnpm treats the target as a standalone project.

#### Scenario: cwd is a workspace member
- **WHEN** PackageManager runs at `/repo/packages/devkit-cli/` (a directory listed in `pnpm-workspace.yaml`'s `packages:` glob)
- **THEN** the resulting `pnpm install` command SHALL NOT include `--ignore-workspace`

#### Scenario: cwd is non-member nested directory in monorepo
- **WHEN** PackageManager runs at `/repo/packages/devkit-cli/test-app/` (inside the monorepo tree but not matched by any workspace glob)
- **THEN** the resulting `pnpm install` command SHALL include `--ignore-workspace`

#### Scenario: cwd is fully outside any monorepo
- **WHEN** PackageManager runs at `/tmp/standalone-app/` (no `pnpm-workspace.yaml` in any ancestor)
- **THEN** the resulting `pnpm install` command SHALL NOT include `--ignore-workspace` (workspace mode is irrelevant)

#### Scenario: Non-pnpm package manager unaffected
- **WHEN** PackageManager is bound to npm or yarn (not pnpm)
- **THEN** `--ignore-workspace` SHALL NOT be appended (the flag is pnpm-only)

### Requirement: Binary mirror probe failures are silent
The `PackageManager.setBinaryMirrors` method SHALL silently absorb failures during `getMetadata('binary-mirror-config')` lookup. The method SHALL NOT print to stderr and SHALL NOT throw when the lookup fails. Failures SHALL be logged via the optional `logger.debug` channel only.

#### Scenario: Probe failure stays out of stderr
- **WHEN** `setBinaryMirrors` is called against a registry where `binary-mirror-config` package metadata is unreachable or returns invalid response
- **THEN** the user-visible stderr SHALL NOT contain `ERR_INVALID_PROTOCOL` or any other related error trace
- **AND** the create / install flow SHALL continue unimpeded

#### Scenario: Probe timeout
- **WHEN** the registry response for `binary-mirror-config` exceeds 5 seconds
- **THEN** `setBinaryMirrors` SHALL abort the lookup and return without setting environment variables
- **AND** subsequent install SHALL run without binary mirror env tweaks
