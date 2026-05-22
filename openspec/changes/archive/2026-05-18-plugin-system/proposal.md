## Why

The three plugins (React, Mock, Request) are the extensibility layer of bundle-bundlekit. They are currently empty shells (empty entry files, empty generators, empty templates). Without them, the plugin system demonstrated in the Service code has no actual consumers, and users get no out-of-box support for React builds, mock APIs, or HTTP client generation.

## What Changes

- **React plugin**: Export plugin that registers `plugin:react` command, modifies build config for JSX/React preset, provides TS and JS templates
- **Mock plugin**: Export plugin that configures devServer proxy to mock service, uses json-server to serve mock APIs from project `mock/` directory
- **Request plugin**: Export plugin that generates HTTP client code with dual engine support (axios / fetch), exposes unified API surface, supports `request:generate` command for swagger/openapi code generation
- All plugins implement the `IPluginAPI` interface and register via `api.registerCommand` / `api.modifyBuildConfig`

## Capabilities

### New Capabilities
- `plugin-react`: React build configuration injection and project templates
- `plugin-mock`: Mock API server with proxy configuration
- `plugin-request`: HTTP client generation with axios/fetch dual engine

### Modified Capabilities
<!-- None -->

## Impact

- Affected packages: `@bundlekit/plugin-react`, `@bundlekit/plugin-mock`, `@bundlekit/plugin-request`
- Dependencies: `json-server` (already in mock plugin), `axios`, `@bundlekit/shared-utils`
- Breaks nothing: all empty stubs
