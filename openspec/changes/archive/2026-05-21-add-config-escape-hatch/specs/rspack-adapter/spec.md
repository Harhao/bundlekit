## ADDED Requirements

### Requirement: Rspack adapter integrates tools hook

After `transformConfig` returns the rspack `RspackOptions`, the system SHALL invoke `tools.rspack(config, ctx)` if declared, and pass the resulting (possibly mutated) `RspackOptions` to subsequent steps.

#### Scenario: Hook adds an rspack plugin
- **WHEN** the user declares `tools.rspack` that pushes a custom plugin into `config.plugins`
- **AND** runs `bundlekit-service serve --bundler rspack`
- **THEN** the resulting rspack compiler SHALL include the custom plugin in its plugin list
