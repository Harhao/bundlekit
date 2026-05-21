## ADDED Requirements

### Requirement: Rollup adapter integrates tools hook

After `transformConfig` returns the rollup `RollupOptions`, the system SHALL invoke `tools.rollup(config, ctx)` if declared, and pass the resulting (possibly mutated) `RollupOptions` to subsequent steps.

#### Scenario: Hook adds a rollup plugin
- **WHEN** the user declares `tools.rollup` that pushes a custom plugin into `config.plugins`
- **AND** runs `devkit-service build --bundler rollup`
- **THEN** the resulting rollup pipeline SHALL include the custom plugin in its plugin list
