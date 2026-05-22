## MODIFIED Requirements

### Requirement: Resolve relative paths
The system SHALL resolve all relative paths in the config (entry, outDir, resolve aliases) to absolute paths relative to the project root, supporting string, array, and object map entry formats.

#### Scenario: Relative string entry path resolution
- **WHEN** user config has `entry: "src/index.ts"` and project root is `/app`
- **THEN** the resolved entry SHALL be `/app/src/index.ts`

#### Scenario: Object map entry path resolution
- **WHEN** user config has `entry: { main: "src/main.ts", worker: "src/worker.ts" }` and project root is `/app`
- **THEN** the resolved entry SHALL be `{ main: "/app/src/main.ts", worker: "/app/src/worker.ts" }`

#### Scenario: Array entry path resolution
- **WHEN** user config has `entry: ["src/main.ts", "src/polyfill.ts"]` and project root is `/app`
- **THEN** the resolved entry SHALL be `["/app/src/main.ts", "/app/src/polyfill.ts"]`

## ADDED Requirements

### Requirement: IBuildConfig supports partial environment config
The `IBuildConfig.config` field SHALL accept any subset of `IBuildEnv` keys; not all environment keys are required.

#### Scenario: Only development config defined
- **WHEN** user's `.bundlekitrc.ts` defines only a `development` key in `config`
- **THEN** the system SHALL load and merge it successfully without TypeScript errors

#### Scenario: Default config does not require all envs
- **WHEN** `getDefaultConfig()` returns a config with only `development` and `production` defined
- **THEN** TypeScript SHALL accept this without type assertions
