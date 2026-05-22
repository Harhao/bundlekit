## MODIFIED Requirements

### Requirement: Template selection
The `create` command SHALL support `--template` option to select a project template (`react-ts`, `react-js`, `vue3-ts`, `vue3-js`). If not specified, SHALL prompt interactively.

#### Scenario: Template specified via flag
- **WHEN** user runs `bundlekit-cli create my-app --template vue3-ts`
- **THEN** the system SHALL use the `vue3-ts` template without prompting

#### Scenario: Interactive template selection
- **WHEN** user runs `bundlekit-cli create my-app` without `--template`
- **THEN** the system SHALL display an interactive dropdown with all available templates including `vue3-ts` and `vue3-js`
