# cli-create Specification

## Purpose
TBD - created by archiving change cli-scaffolding. Update Purpose after archive.
## Requirements
### Requirement: Validate project name
The `create` command SHALL validate the project name: it must be a non-empty, valid npm package name, and must not conflict with an existing directory.

#### Scenario: Valid project name
- **WHEN** user runs `devkit-cli create my-app`
- **THEN** the system SHALL proceed with project creation

#### Scenario: Existing directory conflict
- **WHEN** user runs `devkit-cli create my-app` and `./my-app` already exists
- **THEN** the system SHALL display an error and exit

#### Scenario: Invalid package name
- **WHEN** user runs `devkit-cli create "My App"` (contains space)
- **THEN** the system SHALL display an error about invalid package name

### Requirement: Template selection
The `create` command SHALL support `--template` option to select a project template (e.g., `react-ts`, `react-js`, `vanilla`). If not specified, SHALL prompt interactively.

#### Scenario: Template specified via flag
- **WHEN** user runs `devkit-cli create my-app --template react-ts`
- **THEN** the system SHALL use the `react-ts` template without prompting

#### Scenario: No template specified
- **WHEN** user runs `devkit-cli create my-app` without `--template`
- **THEN** the system SHALL default to `react-ts` template

### Requirement: Complete creation flow
The `create` command SHALL execute the full flow: validate name → select template → generate files → install dependencies → print success message.

#### Scenario: Full creation flow succeeds
- **WHEN** user runs `devkit-cli create my-app --template react-ts`
- **THEN** files SHALL be generated in `./my-app`, dependencies SHALL be installed, and success message SHALL be printed

