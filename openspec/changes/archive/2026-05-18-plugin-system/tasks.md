## 1. React Plugin

- [x] 1.1 Implement plugin entry point with `registerPlugin(api)`
- [x] 1.2 Register `plugin:react` command via `api.registerCommand`
- [x] 1.3 Inject React build config via `api.modifyBuildConfig` (jsx support, babel preset)
- [x] 1.4 Create `template-react-ts` template files (App.tsx, index.tsx, tsconfig.json, package.json, .devkitrc.ts)
- [x] 1.5 Create `template-react-js` template files (App.jsx, index.jsx, package.json, .devkitrc.js)
- [x] 1.6 Implement generator for React templates

## 2. Mock Plugin

- [x] 2.1 Implement plugin entry point with `registerPlugin(api)`
- [x] 2.2 Register mock server command
- [x] 2.3 Configure devServer proxy via `api.modifyBuildConfig`
- [x] 2.4 Implement mock data loading with json-server from `mock/` directory

## 3. Request Plugin

- [x] 3.1 Implement plugin entry point with `registerPlugin(api)`
- [x] 3.2 Register `request:generate` command
- [x] 3.3 Implement axios engine wrapper (get/post/put/delete, interceptors, timeout, baseURL)
- [x] 3.4 Implement fetch engine wrapper with equivalent API surface
- [x] 3.5 Implement swagger/openapi parsing for code generation
- [x] 3.6 Generate typed request functions from API spec

## 4. Verification

- [x] 4.1 Run `pnpm build` for all three plugins
- [x] 4.2 Test React plugin config injection with example project
- [x] 4.3 Test Mock plugin proxy with dev server
- [x] 4.4 Test Request plugin code generation with sample swagger spec
