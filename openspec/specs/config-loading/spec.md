# config-loading Specification

## Purpose
TBD - created by archiving change core-chain. Update Purpose after archive.
## Requirements
### Requirement: Load project config file
The system SHALL load project configuration from `.bundlekitrc.ts` or `.bundlekitrc.js` in the project root directory, with `.bundlekitrc.ts` taking priority over `.bundlekitrc.js`.

#### Scenario: Load TypeScript config
- **WHEN** a `.bundlekitrc.ts` file exists in the project root
- **THEN** the system loads and executes it via `jiti`, returning the default export as `IBuildConfig`

#### Scenario: Fallback to JavaScript config
- **WHEN** no `.bundlekitrc.ts` exists but `.bundlekitrc.js` exists in the project root
- **THEN** the system loads and executes it via `jiti`, returning the default export as `IBuildConfig`

#### Scenario: No config file found
- **WHEN** neither `.bundlekitrc.ts` nor `.bundlekitrc.js` exists in the project root
- **THEN** the system throws an error with a descriptive message indicating no config file was found

### Requirement: Merge config with defaults
The system SHALL deep-merge the user-provided config with default configuration values, where user values override defaults.

#### Scenario: User overrides default entry
- **WHEN** default config has `entry: "src/index"` and user config has `entry: "src/main"`
- **THEN** the resolved config SHALL use `entry: "src/main"`

#### Scenario: Default values for missing fields
- **WHEN** user config omits the `outDir` field
- **THEN** the resolved config SHALL use the default `outDir` value

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

### Requirement: IBuildConfig supports partial environment config
The `IBuildConfig.config` field SHALL accept any subset of `IBuildEnv` keys; not all environment keys are required.

#### Scenario: Only development config defined
- **WHEN** user's `.bundlekitrc.ts` defines only a `development` key in `config`
- **THEN** the system SHALL load and merge it successfully without TypeScript errors

#### Scenario: Default config does not require all envs
- **WHEN** `getDefaultConfig()` returns a config with only `development` and `production` defined
- **THEN** TypeScript SHALL accept this without type assertions

