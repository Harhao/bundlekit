# plugin-mock Specification

## Purpose
TBD - created by archiving change plugin-system. Update Purpose after archive.
## Requirements
### Requirement: Plugin registration
The Mock plugin SHALL export a valid `IPluginAPI` object with `registerPlugin` method.

#### Scenario: Plugin initializes with service
- **WHEN** the Mock plugin is loaded
- **THEN** it SHALL obtain the service API and register its commands

### Requirement: Dev server proxy configuration
The Mock plugin SHALL modify the build config to add a proxy rule from the dev server to the mock service.

#### Scenario: Proxy rule added
- **WHEN** the Mock plugin runs and mock server is on port 4000
- **THEN** the build config `devServer.proxy` SHALL include `{ "/api": "http://localhost:4000" }`

### Requirement: Mock data loading
The Mock plugin SHALL load mock route definitions from the project's `mock/` directory using json-server.

#### Scenario: Load JSON database
- **WHEN** project has `mock/db.json`
- **THEN** json-server SHALL serve its contents as REST API endpoints

