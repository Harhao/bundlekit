## Design: Plugin System

### React Plugin

- `registerPlugin(api)`: register `plugin:react` command
- `api.modifyBuildConfig()`: inject `jsx: "react-jsx"` or babel preset-react
- Templates: `template-react-ts` (TypeScript + React 18), `template-react-js` (JavaScript + React 18)

### Mock Plugin

- `registerPlugin(api)`: proxy `/api` → local mock server
- `api.modifyBuildConfig()`: add `devServer.proxy`
- Use `json-server` to serve `mock/db.json` or express middleware

### Request Plugin

- `registerPlugin(api)`: register `request:generate` command
- Engine selection via `.devkitrc.ts` `request.engine: "axios" | "fetch"`
- Generate wrapper: `get/post/put/delete` with interceptors, timeout, baseURL
- Fetch engine: wrap native fetch with equivalent API surface
- Swagger/openapi parsing for code generation
