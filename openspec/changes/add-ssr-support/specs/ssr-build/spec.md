## ADDED Requirements

### Requirement: SSR config field on IEnvBuildConfig

The `IEnvBuildConfig` type SHALL expose an optional `ssr` field. When present, the field SHALL describe how to produce a server bundle alongside the existing client bundle. The `ssr` field SHALL include `entry` (server entry path), `output` (server output dir / filename / format), optional `externals` (`'auto'` or array of patterns), optional `template` (HTML template with placeholder), and optional `placeholder` (default `<!--ssr-outlet-->`).

#### Scenario: SSR enabled
- **WHEN** `.devkitrc.ts` declares `config.production.ssr = { entry: 'src/entry-server.tsx', output: { dir: 'dist/server', filename: 'server.cjs', formats: 'commonjs' } }`
- **THEN** the schema SHALL accept the configuration as valid
- **AND** the runtime SHALL treat the env as SSR-enabled

#### Scenario: SSR disabled (default)
- **WHEN** `.devkitrc.ts` does not declare `ssr` for an env
- **THEN** the runtime SHALL produce only a client bundle for that env, with no behavior change versus current

### Requirement: SSR mutually exclusive with target=node and pages[]

The system SHALL reject configurations that simultaneously enable `ssr` with either `target: 'node'` or a non-empty `pages[]` for the same env.

#### Scenario: SSR + target=node rejected
- **WHEN** `envConfig.target === 'node'` and `envConfig.ssr` is set
- **THEN** the system SHALL exit with a non-zero status and an explicit error message naming both fields

#### Scenario: SSR + pages rejected
- **WHEN** `envConfig.pages` is non-empty and `envConfig.ssr` is set
- **THEN** the system SHALL exit with a non-zero status and an explicit error message stating SSR is single-page only

### Requirement: Build pipeline produces dual artifacts

When `ssr` is enabled, the `devkit-service build` command SHALL produce two artifacts: a client bundle (using existing client config, output dir from envConfig.output) and a server bundle (using ssr.entry / ssr.output / target='node' / externals as configured). The two passes SHALL run sequentially in the order client → server.

#### Scenario: Build produces dist/client and dist/server
- **WHEN** user runs `devkit-service build --bundler webpack --mode production` with SSR enabled
- **AND** envConfig.output.dir = 'dist/client', ssr.output.dir = 'dist/server', ssr.output.filename = 'server.cjs'
- **THEN** after build the file `dist/client/index.html` SHALL exist
- **AND** the file `dist/server/server.cjs` SHALL exist
- **AND** `require('dist/server/server.cjs')` SHALL export a function `render(url): string | Promise<string>`

#### Scenario: SSR build failure terminates with non-zero
- **WHEN** the server pass build fails (compile error)
- **THEN** the system SHALL log the error and exit with a non-zero status code, regardless of client pass success

### Requirement: SSR externals 'auto' behavior

When `ssr.externals === 'auto'`, the system SHALL externalize all packages listed under the project's `package.json` `dependencies` (and any nested resolution under `node_modules`), keeping the server bundle small and avoiding double-instances of frameworks (e.g. react).

#### Scenario: Auto externals exclude node_modules
- **WHEN** the project depends on `react@18` and `lodash-es@4`
- **AND** `ssr.externals === 'auto'`
- **THEN** the produced `dist/server/server.cjs` SHALL NOT contain bundled copies of `react` or `lodash-es`
- **AND** the file SHALL `require('react')` / `require('lodash-es')` at runtime instead

#### Scenario: Custom externals array
- **WHEN** `ssr.externals = ['some-package', /^@scope\//]`
- **THEN** only the matched packages SHALL be externalized; others SHALL be bundled

### Requirement: ToolsCtx.env reflects current pass

The `ctx.env` field passed to `tools[bundler]` hooks SHALL be `'server'` during the server pass and `'client'` during the client pass.

#### Scenario: tools.webpack receives env=server
- **WHEN** SSR is enabled and the server pass executes
- **AND** the user declares `tools.webpack(config, ctx)`
- **THEN** the hook SHALL be invoked with `ctx.env === 'server'`

#### Scenario: tools.webpack receives env=client
- **WHEN** SSR is enabled and the client pass executes
- **THEN** the hook SHALL be invoked with `ctx.env === 'client'`
