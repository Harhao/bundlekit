## ADDED Requirements

### Requirement: Start mock server
The `mock` command SHALL start a mock API server based on project `mock/` directory contents.

#### Scenario: Start with mock directory
- **WHEN** user runs `bundlekit-cli mock` and project has `mock/` directory with route definitions
- **THEN** a mock server SHALL start on the configured port, serving the defined routes

#### Scenario: No mock directory
- **WHEN** user runs `bundlekit-cli mock` and no `mock/` directory exists
- **THEN** the system SHALL display a warning and exit or start with empty mock config

### Requirement: Mock server options
The `mock` command SHALL accept `--port` and `--watch` options.

#### Scenario: Custom port
- **WHEN** user runs `bundlekit-cli mock --port 4000`
- **THEN** the mock server SHALL listen on port 4000

#### Scenario: Watch mode
- **WHEN** user runs `bundlekit-cli mock --watch`
- **THEN** the mock server SHALL restart when mock files change
