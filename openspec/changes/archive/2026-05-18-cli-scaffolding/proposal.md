## Why

The `bundlekit-cli` is the user-facing entry point for project creation and mock service management. Currently all commands except `create` are stubs, `creator.ts` has syntax errors with undefined variables, and the Generator class is empty. Without a working CLI, users cannot scaffold projects or run mock servers.

## What Changes

- **creator.ts**: Fix variable reference errors, complete project creation flow (validate name → select template → render → install deps)
- **Generator class**: Implement ejs-based template rendering with recursive directory scanning
- **mock command**: Read project `mock/` directory, start json-server or express service with route registration
- **CLI index**: Complete all TODO items (parameter processing, template generation, dependency installation, output messages)
- Command options: `--template`, `--port`, `--watch` for respective commands

## Capabilities

### New Capabilities
- `cli-create`: Project scaffolding from templates (validate → render → install)
- `cli-generator`: Template rendering engine (ejs-based, recursive directory processing)
- `cli-mock`: Mock API server (json-server based, reads project mock/ directory)

### Modified Capabilities
<!-- None -->

## Impact

- Affected packages: `@bundlekit/cli`
- Dependencies: `ejs` (template engine), `@bundlekit/shared-utils` (logger, spinner, pkgManager)
- Breaks nothing: no working consumers
