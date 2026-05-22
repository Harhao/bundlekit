# cli-ink-ui Specification

## Purpose
TBD - created by archiving change improve-cli-ux. Update Purpose after archive.
## Requirements
### Requirement: ink-based interactive UI in TTY

When `process.stdout.isTTY` is `true` and `DEVKIT_NO_INK` is not set, all interactive cli commands (`create`, `add`, and any future commands requiring prompts) SHALL render their UI using `ink` components rather than direct `console.log` and `enquirer` prompts.

#### Scenario: TTY launches ink
- **WHEN** user runs `bundlekit-cli create my-app` in a TTY (interactive shell)
- **THEN** the cli SHALL render an ink-based App component
- **AND** the user SHALL see a banner, step-by-step prompts, animated spinner, and final success view

#### Scenario: Step-based create flow
- **WHEN** the create command needs both `--template` and `--bundler`
- **AND** neither is provided as a flag
- **THEN** the cli SHALL render two sequential `<SelectInput>` steps: "模板" then "打包器"
- **AND** the title bar SHALL show progress like "Step 1/4 · 模板"

#### Scenario: Spinner for long-running tasks
- **WHEN** the create command renders templates, runs `pnpm install`, or invokes a generator
- **THEN** an `ink-spinner` SHALL render alongside the current task description
- **AND** upon completion the spinner SHALL be replaced with a check mark and the task name

### Requirement: TTY fallback to legacy interactive flow

When `process.stdout.isTTY` is `false` or `DEVKIT_NO_INK=1`, the cli SHALL bypass ink entirely and use the legacy enquirer + Logger interaction path. Functional behavior SHALL be equivalent.

#### Scenario: CI environment
- **WHEN** the cli is invoked from a CI environment where `process.stdout.isTTY === false`
- **THEN** the cli SHALL NOT load ink components
- **AND** SHALL execute prompts via `enquirer.prompt()` (or accept all flags non-interactively)

#### Scenario: User opt-out
- **WHEN** environment variable `DEVKIT_NO_INK` equals `1`
- **THEN** the cli SHALL use the legacy path even in a TTY

### Requirement: ink commands exit cleanly on Ctrl+C

When the user presses Ctrl+C during an ink-rendered prompt, the cli SHALL clean up the render, restore the terminal state, and exit with status code 130 (or the configured SIGINT exit code).

#### Scenario: Ctrl+C during select
- **WHEN** the user presses Ctrl+C while a `<SelectInput>` is active
- **THEN** the cli SHALL stop rendering, restore terminal cursor, and exit non-zero
- **AND** SHALL NOT leave half-written files on disk (rendering should not have started yet at the prompt stage)

### Requirement: Error view on failure

When any action (template render, install, generator) throws, the cli SHALL render an `<ErrorView>` ink component showing the step name, error message, and a collapsed stack trace, then exit with non-zero status.

#### Scenario: Install fails
- **WHEN** `pnpm install` exits non-zero during create
- **THEN** the cli SHALL transition to the error view showing the install error message
- **AND** SHALL exit with non-zero status code

#### Scenario: Generator throws
- **WHEN** a plugin generator throws an exception
- **THEN** the cli SHALL render the error stack and exit non-zero

### Requirement: ESM-only cli distribution

The published `@bundlekit/cli` package SHALL provide only an ESM entry point. The `bin.bundlekit-cli` and `bin.dc` fields SHALL both reference `./dist/index.mjs`.

#### Scenario: Inspect published manifest
- **WHEN** inspecting the published `@bundlekit/cli` package's `package.json`
- **THEN** the `bin.bundlekit-cli` field SHALL end in `.mjs`
- **AND** the `bin.dc` field SHALL end in `.mjs`
- **AND** there SHALL NOT be a `dist/index.cjs` entry (the cjs build is removed)

### Requirement: Generator API stability

The `IGeneratorAPI` interface (`prompt`, `log`, etc.) SHALL remain unchanged so that existing plugin generators (`@bundlekit/plugin-react/generator`, `@bundlekit/plugin-vue/generator`, etc.) continue to work without modification.

#### Scenario: Existing generator continues to work
- **WHEN** an unmodified `@bundlekit/plugin-react/generator` is invoked from the new ink-powered cli
- **THEN** the generator SHALL receive the same `IGeneratorAPI` shape and produce identical results

#### Scenario: prompt implementation behind facade
- **WHEN** the cli calls `generator.generate(context, api)`
- **THEN** the cli MAY internally implement `api.prompt(...)` via ink components or fall back to enquirer; the generator SHALL NOT be aware of the underlying implementation

