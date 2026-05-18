## ADDED Requirements

### Requirement: Plugin registration
The Request plugin SHALL export a valid `IPluginAPI` object that registers `request:generate` command and hooks into the build lifecycle.

#### Scenario: Plugin registers command
- **WHEN** the Request plugin is loaded
- **THEN** it SHALL register `request:generate` via `api.registerCommand`

### Requirement: Dual engine support
The Request plugin SHALL support both `axios` and `fetch` as the underlying HTTP engine, configured via `.devkitrc.ts` `request.engine` field.

#### Scenario: Axios engine
- **WHEN** `request.engine` is `"axios"`
- **THEN** the generated code SHALL use axios for HTTP requests with interceptors, timeout, and baseURL configured

#### Scenario: Fetch engine
- **WHEN** `request.engine` is `"fetch"`
- **THEN** the generated code SHALL use native fetch API wrapping it with equivalent interceptor, timeout, and baseURL support

### Requirement: Unified API surface
The generated request code SHALL expose the same API surface regardless of engine: `get(url, config)`, `post(url, data, config)`, `put(url, data, config)`, `delete(url, config)`.

#### Scenario: API consistency
- **WHEN** switching from axios to fetch engine
- **THEN** existing business code using the request layer SHALL NOT need modification

### Requirement: Code generation from swagger/openapi
The `request:generate` command SHALL generate typed request functions from swagger/openapi specification files.

#### Scenario: Generate from swagger file
- **WHEN** user runs `request:generate --source ./api-spec.yaml`
- **THEN** the system SHALL parse the spec and generate typed `api/` directory with request functions
