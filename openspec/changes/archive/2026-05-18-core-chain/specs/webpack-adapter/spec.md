## ADDED Requirements

### Requirement: Transform config from IBuildConfig
The `TransformConfig` class SHALL convert an `IBuildConfig` object into a valid webpack 5 `Configuration` object, mapping entry, output, resolve, module rules, and plugins.

#### Scenario: Entry mapping
- **WHEN** `IBuildConfig.entry` is `{ app: "src/index.ts" }` and project root is `/app`
- **THEN** the webpack `entry` SHALL be `{ app: "/app/src/index.ts" }`

#### Scenario: Output mapping
- **WHEN** `IBuildConfig.outDir` is `"dist"` and project root is `/app`
- **THEN** the webpack `output.path` SHALL be `/app/dist` and `output.libraryTarget` SHALL be `"umd"`

### Requirement: Dev server configuration
The webpack adapter SHALL configure `devServer` from `IBuildConfig.devServer`, including port, host, https, and proxy settings.

#### Scenario: Proxy configuration
- **WHEN** `IBuildConfig.devServer.proxy` contains `{ "/api": "http://localhost:4000" }`
- **THEN** the webpack `devServer.proxy` SHALL contain the corresponding proxy rule

#### Scenario: HMR enabled by default
- **WHEN** mode is development
- **THEN** webpack `devServer.hot` SHALL be `true`

### Requirement: Module rules for TypeScript and assets
The webpack adapter SHALL configure module rules for `.ts`/`.tsx` files using `thread-loader` + `ts-loader`, and for image/font/asset files using webpack 5 asset modules.

#### Scenario: TypeScript processing
- **WHEN** the project contains `.ts` or `.tsx` files
- **THEN** webpack SHALL process them through `thread-loader` and `ts-loader`

### Requirement: Configuration validation
The webpack adapter SHALL validate the generated webpack configuration against webpack's JSON schema before returning it.

#### Scenario: Valid config passes
- **WHEN** a valid webpack configuration is generated
- **THEN** `validateConfig()` SHALL return `true`

#### Scenario: Invalid config fails
- **WHEN** the generated config has a missing required field
- **THEN** `validateConfig()` SHALL return `false`
