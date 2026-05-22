## ADDED Requirements

### Requirement: Generator skips prompt in non-interactive contexts
The `@bundlekit/plugin-vue` generator SHALL skip its interactive `enquirer` prompts when any of the following conditions is true:
- `process.stdout.isTTY` is falsy
- `process.env.DEVKIT_NO_PROMPT === "1"`
- `process.env.CI === "true"` or `process.env.CI === "1"`

When the prompt is skipped, the generator SHALL proceed with documented default values (e.g. `installRequest: false`).

#### Scenario: ink mode skips prompt
- **WHEN** the cli invokes the generator with `DEVKIT_NO_PROMPT=1` set
- **THEN** the generator SHALL NOT call `api.prompt`
- **AND** the generator SHALL NOT add `@bundlekit/request` as a dependency

#### Scenario: Real TTY shows prompt
- **WHEN** the generator runs in a real TTY without any skip env var set
- **AND** the user is invoking it via `dc add vue`
- **THEN** the generator SHALL display the `installRequest` prompt
- **AND** the prompt SHALL be preceded by a visible blank line and a colored separator to ensure it is not visually obscured by prior spinner output

### Requirement: Generator uses workspace protocol for internal deps
When the `@bundlekit/plugin-vue` generator adds `@bundlekit/*` dependencies via `api.addDependency`, it SHALL use the `workspace:^` protocol value, NOT a hardcoded semver range like `^1.0.0`. The CLI's `normalizeDeps` step is responsible for converting `workspace:^` to a concrete `link:` URI or `^cliVersion` range before the final write.

#### Scenario: addDependency uses workspace protocol
- **WHEN** the generator's `prompt` answer indicates `installRequest: true`
- **THEN** `api.addDependency("@bundlekit/request", "workspace:^")` SHALL be called
- **AND** NO call SHALL pass a hardcoded version such as `"^1.0.0"`

#### Scenario: Generated package.json has normalized version
- **WHEN** the generator returns control to the CLI in monorepo mode (`depMode.kind === 'link'`)
- **AND** `normalizeDeps` runs after `runGenerator`
- **THEN** the resulting `package.json` SHALL contain `"@bundlekit/request": "link:/abs/path/to/packages/bundlekit-request"`
- **AND** SHALL NOT contain `"workspace:^"` literal
