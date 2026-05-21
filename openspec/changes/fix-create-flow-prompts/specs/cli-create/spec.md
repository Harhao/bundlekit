## MODIFIED Requirements

### Requirement: Complete creation flow
The `create` command SHALL execute the full flow: validate name → select template → select bundler → select package manager → enter description → render templates → normalize dependency versions → write bundler to devDependencies → install dependencies (using selected PM) → invoke framework generator → normalize dependency versions a second time (in case generator added new `workspace:^` entries) → install pending dependencies if any → print success message with PM-aware startup commands.

When the CLI runs in ink TTY mode, in CI (`CI=true|1`), or in a non-TTY environment, the framework generator SHALL be invoked with `DEVKIT_NO_PROMPT=1` set in its process environment. The CLI SHALL set this environment variable before invoking `runGenerator` and SHALL restore the prior value (or unset) afterwards.

The `normalize dependency versions` step SHALL replace every `workspace:^` literal in the generated `package.json` with either a `link:` URI (monorepo mode) or a `^${cliVersion}` range (npm mode), so the resulting file is consumable by any package manager outside a pnpm workspace. The step SHALL run twice: once after `renderTemplates`, and once after `runGenerator`. The final `package.json` written to disk SHALL NOT contain any `workspace:^` literal regardless of which step added the entry.

#### Scenario: ink path silences generator prompt
- **WHEN** the CLI is invoked via `dc create my-app -t react-ts -b vite --pm pnpm` in a real TTY
- **AND** ink rendering is active (default unless `DEVKIT_NO_INK=1`)
- **THEN** before invoking the framework generator, the CLI SHALL set `process.env.DEVKIT_NO_PROMPT = "1"`
- **AND** the generator SHALL NOT block waiting for any keyboard input
- **AND** the resulting project SHALL be created without optional dependencies (e.g. `@devkit/request`) unless they were added via subsequent `dc add` calls

#### Scenario: CI environment silences generator prompt
- **WHEN** the CLI runs with `CI=true` or `CI=1` in environment
- **THEN** the generator SHALL skip its interactive prompts
- **AND** the create flow SHALL complete without timing out on stdin

#### Scenario: Generator-added workspace literal normalized after install
- **WHEN** the framework generator calls `api.addDependency("@devkit/request", "workspace:^")`
- **THEN** the CLI SHALL run `normalizeDeps` again before the second `installDeps` call
- **AND** the final `package.json` SHALL contain a `link:` URI or `^cliVersion` range for `@devkit/request`, but never a `workspace:^` literal

#### Scenario: Generated package.json never contains hardcoded ^1.0.0
- **WHEN** the CLI generates any project under `react-ts`, `react-js`, `vue3-ts`, `vue3-js` template
- **AND** the framework generator runs to completion
- **THEN** the resulting `package.json` SHALL NOT contain `"^1.0.0"` literal as a value of any `@devkit/*` dependency
