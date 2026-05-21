## ADDED Requirements

### Requirement: Vite adapter integrates tools hook

After `transformConfig` returns the vite `InlineConfig`, the system SHALL invoke `tools.vite(config, ctx)` if declared, and pass the resulting (possibly mutated) `InlineConfig` to subsequent steps.

#### Scenario: Hook adds a vite plugin
- **WHEN** the user declares `tools.vite` that pushes a custom plugin into `config.plugins`
- **AND** runs `devkit-service serve --bundler vite`
- **THEN** the resulting vite server SHALL include the custom plugin in its plugin list

#### Scenario: Hook tweaks server settings
- **WHEN** the user declares `tools.vite` that mutates `config.server.cors`
- **THEN** the running vite server SHALL reflect the mutated cors setting
