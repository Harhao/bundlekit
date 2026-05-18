## ADDED Requirements

### Requirement: Transform config from IBuildConfig
The Rollup adapter SHALL convert an `IBuildConfig` object into a valid Rollup `RollupOptions` configuration, including input, output (UMD format), resolve extensions and aliases, and plugins.

#### Scenario: Complete config transformation
- **WHEN** `IBuildConfig` contains entry, outDir, resolve.extension, and resolve.alias
- **THEN** the generated Rollup config SHALL contain corresponding `input`, `output.dir`, `output.format: "umd"`, and `resolve` settings

### Requirement: Production build produces output
The Rollup adapter SHALL call `bundle.write()` after `rollup.rollup()` in production mode, producing output files at the configured directory.

#### Scenario: Production build writes files
- **WHEN** `run()` is called in production mode
- **THEN** output files SHALL be written to the configured `outDir`

### Requirement: Watch mode for development
The Rollup adapter SHALL use `rollup.watch()` in development mode with proper error and rebuild logging.

#### Scenario: Watch mode updates on file change
- **WHEN** `run()` is called in development mode
- **THEN** `rollup.watch()` SHALL be called and SHALL log rebuild status on file changes

### Requirement: Plugin configuration
The Rollup adapter SHALL include standard plugins: `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`, `@rollup/plugin-typescript`, and `@rollup/plugin-babel`.

#### Scenario: Standard plugins present
- **WHEN** the config is generated
- **THEN** node-resolve, commonjs, typescript, and babel plugins SHALL be included in the Rollup config
