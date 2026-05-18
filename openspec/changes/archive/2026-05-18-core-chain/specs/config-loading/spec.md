## ADDED Requirements

### Requirement: Load project config file
The system SHALL load project configuration from `.devkitrc.ts` or `.devkitrc.js` in the project root directory, with `.devkitrc.ts` taking priority over `.devkitrc.js`.

#### Scenario: Load TypeScript config
- **WHEN** a `.devkitrc.ts` file exists in the project root
- **THEN** the system loads and executes it via `jiti`, returning the default export as `IBuildConfig`

#### Scenario: Fallback to JavaScript config
- **WHEN** no `.devkitrc.ts` exists but `.devkitrc.js` exists in the project root
- **THEN** the system loads and executes it via `jiti`, returning the default export as `IBuildConfig`

#### Scenario: No config file found
- **WHEN** neither `.devkitrc.ts` nor `.devkitrc.js` exists in the project root
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
The system SHALL resolve all relative paths in the config (entry, outDir, resolve aliases) to absolute paths relative to the project root.

#### Scenario: Relative entry path resolution
- **WHEN** user config has `entry: "src/index.ts"` and project root is `/app`
- **THEN** the resolved entry SHALL be `/app/src/index.ts`
