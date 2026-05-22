## ADDED Requirements

### Requirement: Vitest test framework configured
The system SHALL have Vitest configured at the monorepo root with support for TypeScript, ESM modules, and path aliases matching the project's tsconfig.

#### Scenario: Run all tests
- **WHEN** user runs `pnpm test` at the repo root
- **THEN** Vitest SHALL discover and run all `*.test.ts` files under `__tests__/`

#### Scenario: ESM module support
- **WHEN** test files import from packages using `import` syntax
- **THEN** Vitest SHALL resolve and execute them without transformation errors

### Requirement: ConfigLoader unit tests
The system SHALL have unit tests covering all public methods of `ConfigLoader`.

#### Scenario: loadDevkitFileConfig resolves .ts config
- **WHEN** a `.bundlekitrc.ts` file exists in the test fixture root
- **THEN** `loadDevkitFileConfig()` SHALL return the parsed `IBuildConfig` object

#### Scenario: loadDevkitFileConfig throws when no config file
- **WHEN** neither `.bundlekitrc.ts` nor `.bundlekitrc.js` exists
- **THEN** `loadDevkitFileConfig()` SHALL throw an error

#### Scenario: resolvePaths resolves string entry
- **WHEN** config entry is `"src/index.ts"` and context is `/project`
- **THEN** resolved entry SHALL be `/project/src/index.ts`

#### Scenario: resolvePaths resolves object entry
- **WHEN** config entry is `{ main: "src/main.ts", worker: "src/worker.ts" }` and context is `/project`
- **THEN** resolved entry SHALL be `{ main: "/project/src/main.ts", worker: "/project/src/worker.ts" }`

#### Scenario: resolvePaths resolves array entry
- **WHEN** config entry is `["src/main.ts", "src/polyfill.ts"]` and context is `/project`
- **THEN** resolved entry SHALL be `["/project/src/main.ts", "/project/src/polyfill.ts"]`

### Requirement: validateBuildConfig unit tests
The system SHALL have unit tests covering all branches of `validateBuildConfig`.

#### Scenario: Valid config passes
- **WHEN** a complete valid `IBuildConfig` is provided
- **THEN** `validateBuildConfig` SHALL return `{ valid: true, errors: [] }`

#### Scenario: Missing entry fails
- **WHEN** config has no `entry` field in the env config
- **THEN** `validateBuildConfig` SHALL return `{ valid: false, errors: [<message containing "entry">] }`

#### Scenario: Null config handled first
- **WHEN** config is `null` or `undefined`
- **THEN** `validateBuildConfig` SHALL return `{ valid: false, errors: [<non-empty>] }` without throwing

### Requirement: Service unit tests
The system SHALL have unit tests for the core Service methods.

#### Scenario: Plugin apply receives latest buildConfig
- **WHEN** plugin A modifies buildConfig via `modifyBuildConfig` and plugin B is applied after
- **THEN** plugin B's apply function SHALL receive the updated config from plugin A

#### Scenario: getBundlerRegistry returns correct mapping
- **WHEN** `getBundlerRegistry()` is called
- **THEN** it SHALL return an object mapping `"webpack"` to `"@bundlekit/bundler-webpack"` (and similarly for other bundlers)
