# bundler-integration-suite Specification

## Purpose
TBD - created by archiving change add-bundler-integration-suite. Update Purpose after archive.
## Requirements
### Requirement: Fixture-driven integration test infrastructure
The repository SHALL provide a `__tests__/integration/` directory containing fixture-based integration tests, separated from unit tests by an independent `vitest.integration.config.ts`. The integration suite SHALL be invokable via the root-level npm script `test:integration`.

#### Scenario: Integration suite isolated from unit tests
- **WHEN** developer runs `pnpm test`
- **THEN** only unit tests in `__tests__/*.test.ts` SHALL execute
- **AND** integration tests SHALL NOT run

#### Scenario: Integration suite runnable independently
- **WHEN** developer runs `pnpm test:integration`
- **THEN** vitest SHALL load `vitest.integration.config.ts`
- **AND** all tests under `__tests__/integration/**/*.test.ts` SHALL execute
- **AND** test timeout SHALL be 60 seconds per test

#### Scenario: Fixtures use shared source code
- **WHEN** a new bundler fixture is added at `__tests__/integration/fixtures/<bundler>/`
- **THEN** the fixture SHALL reuse `__tests__/integration/fixtures/shared/src/` rather than duplicating source files
- **AND** the fixture SHALL contain its own `.devkitrc.ts` variants and `package.json`

### Requirement: Build matrix coverage
The integration suite SHALL execute a build test for each combination of `{webpack, vite, rspack, rollup, rolldown}` × `{SPA build, Library build, SSR build}`, covering 15 cases. Each test SHALL spawn `devkit-service build` as a subprocess and assert on the produced artifacts.

#### Scenario: SPA build produces client bundle
- **WHEN** the SPA build test runs for any bundler
- **THEN** the test SHALL spawn `devkit-service build --bundler <name> --mode production`
- **AND** the test SHALL assert that `dist/<bundle-name>.js` (or equivalent) exists
- **AND** the bundle file SHALL contain a known marker string from the fixture source

#### Scenario: Library build produces node-targetable bundle
- **WHEN** the Library build test runs for any bundler
- **THEN** the test SHALL spawn `devkit-service build` with `target: 'node'` config
- **AND** the test SHALL `require()` the produced file in node and assert exported names

#### Scenario: SSR build produces dual bundles
- **WHEN** the SSR build test runs for any bundler
- **THEN** the test SHALL assert both `dist/client/` and `dist/server/server.cjs` exist
- **AND** the test SHALL `require('dist/server/server.cjs').render('/')` and assert the returned HTML contains the SSR marker

### Requirement: Dev SSR HTTP coverage
The integration suite SHALL execute a dev SSR HTTP test for each bundler in `{webpack, vite, rspack, rollup, rolldown}`, where the test spawns `devkit-service serve` with SSR enabled, performs HTTP GET against a dynamic port, and asserts the response.

#### Scenario: Dev SSR responds with hydrated HTML (vite/webpack/rspack)
- **WHEN** the dev SSR test runs for vite, webpack, or rspack
- **THEN** the test SHALL spawn `devkit-service serve --bundler <name> --mode development`
- **AND** the test SHALL wait for "server ready" log
- **AND** an HTTP GET to `localhost:<port>/` SHALL return status 200
- **AND** the response body SHALL contain the SSR marker string
- **AND** the response body SHALL contain a hydrate script tag referencing the client entry

#### Scenario: Dev SSR responds with basic HTML (rollup/rolldown)
- **WHEN** the dev SSR test runs for rollup or rolldown
- **THEN** the test SHALL spawn the watch-based service
- **AND** an HTTP GET to `localhost:<port>/` SHALL return status 200
- **AND** the response body SHALL contain the SSR marker string
- **AND** HMR runtime injection SHALL NOT be present

### Requirement: Client HMR validation via Playwright
The integration suite SHALL include Playwright-based HMR tests for vite, webpack, and rspack. Each test SHALL launch a browser, navigate to the dev server, edit a fixture source file, and assert the page updates without a full reload.

#### Scenario: Client HMR updates without page reload
- **WHEN** the HMR test runs for vite, webpack, or rspack
- **THEN** the test SHALL navigate Playwright to `localhost:<port>/`
- **AND** the test SHALL record the initial value of an injected `window.__navigationCount` counter (incremented on each `load` event)
- **AND** the test SHALL edit `fixtures/shared/src/App.tsx` to change the rendered text
- **AND** within 5 seconds, the page SHALL display the updated text
- **AND** `window.__navigationCount` SHALL remain at the initial value (no full reload occurred)

#### Scenario: Fixture source restored after test
- **WHEN** any HMR test completes (success or failure)
- **THEN** the modified fixture file SHALL be restored to its original content
- **AND** `git diff __tests__/integration/fixtures/` SHALL be empty after the suite finishes

### Requirement: Test isolation and cleanup
Each integration test SHALL run in an isolated working directory copied from the fixture template, use a dynamically allocated port, and clean up its subprocess on completion. The suite SHALL NOT leave orphan processes or temporary files after a full run.

#### Scenario: Each test uses dynamic port
- **WHEN** any HTTP-based integration test runs
- **THEN** the test SHALL acquire a free port via `get-port`
- **AND** the port SHALL NOT collide with another concurrent test

#### Scenario: Subprocess cleanup on test completion
- **WHEN** an integration test completes (pass, fail, or timeout)
- **THEN** the spawned `devkit-service` subprocess SHALL be terminated
- **AND** the test SHALL await the process `close` event before resolving
- **AND** no `devkit-service` processes SHALL remain after the suite ends

#### Scenario: Working directory isolation
- **WHEN** a build or dev SSR test starts
- **THEN** the fixture SHALL be copied to a temporary directory (e.g. `/tmp/devkit-int-<hash>/`)
- **AND** all writes (dist/, node_modules/) SHALL go to the temp dir
- **AND** the source fixture SHALL remain unchanged

