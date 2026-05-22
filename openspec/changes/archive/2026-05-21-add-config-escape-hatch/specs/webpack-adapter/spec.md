## ADDED Requirements

### Requirement: Webpack adapter integrates tools hook

After `transformConfig` returns the webpack `Configuration` object, the system SHALL invoke `tools.webpack(config, ctx)` if declared, and pass the resulting (possibly mutated) `Configuration` to subsequent steps.

#### Scenario: Hook adds a webpack plugin
- **WHEN** the user declares `tools.webpack` that pushes a custom plugin into `config.plugins`
- **AND** runs `bundlekit-service serve --bundler webpack`
- **THEN** the resulting webpack compiler SHALL include the custom plugin in its plugin list

#### Scenario: Hook replaces config object
- **WHEN** the user declares `tools.webpack` that returns a brand-new `Configuration`
- **THEN** the returned configuration SHALL be used by webpack-dev-server / webpack compiler instead of the original
