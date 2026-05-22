## MODIFIED Requirements

### Requirement: Generated package.json scripts are minimal
Project templates (`template-react-ts`, `template-react-js`, `template-vue3-ts`, `template-vue3-js`) SHALL generate a `package.json` with exactly three scripts: `clean`, `dev`, `build`. Bundler-specific aliases such as `${bundler}:dev` / `${bundler}:prod` SHALL NOT be generated. Internal `@bundlekit/*` package dependencies SHALL be normalized by the CLI before write so the final `package.json` contains either `link:` URIs (monorepo dev mode) or `^${cliVersion}` ranges (npm mode), and SHALL NOT contain `workspace:^` literals.

#### Scenario: react-ts template scripts
- **WHEN** user runs `bundlekit-cli create my-app -t react-ts -b vite`
- **THEN** the generated `my-app/package.json` `scripts` field SHALL contain exactly three keys: `clean`, `dev`, `build`
- **AND** the field SHALL NOT contain `vite:dev` or `vite:prod`

#### Scenario: vue3-js template scripts
- **WHEN** user runs `bundlekit-cli create my-app -t vue3-js -b webpack`
- **THEN** the generated `my-app/package.json` `scripts` field SHALL contain exactly three keys: `clean`, `dev`, `build`
- **AND** the field SHALL NOT contain `webpack:dev` or `webpack:prod`

#### Scenario: Internal deps normalized in monorepo
- **WHEN** the CLI runs from inside the bundlekit monorepo
- **THEN** every `@bundlekit/*` entry in the generated `package.json.devDependencies` SHALL start with `link:` followed by an absolute path
- **AND** no `workspace:^` literal SHALL appear anywhere

#### Scenario: Internal deps normalized outside monorepo
- **WHEN** the CLI runs from outside any bundlekit monorepo (or with `DEVKIT_DEP_MODE=npm`)
- **THEN** every `@bundlekit/*` entry in the generated `package.json.devDependencies` SHALL be `^${cliVersion}` where `cliVersion` is the CLI's own package version
- **AND** no `workspace:^` literal SHALL appear anywhere
