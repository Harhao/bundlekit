## MODIFIED Requirements

### Requirement: Template selection

The `create` command SHALL support `--template` option to select a project template (e.g., `react-ts`, `react-js`, `vue3-ts`, `vue3-js`). If not specified, SHALL prompt interactively. In a TTY, the prompt SHALL render via ink (`<SelectInput>`); in non-TTY or when `DEVKIT_NO_INK=1`, the prompt SHALL fall back to enquirer.

#### Scenario: Template specified via flag
- **WHEN** user runs `bundlekit-cli create my-app --template react-ts`
- **THEN** the system SHALL use the `react-ts` template without prompting

#### Scenario: No template specified, TTY
- **WHEN** user runs `bundlekit-cli create my-app` without `--template` in a TTY
- **THEN** the system SHALL render an ink `<SelectInput>` with the four available templates

#### Scenario: No template specified, non-TTY
- **WHEN** user runs `bundlekit-cli create my-app` without `--template` in a non-TTY environment
- **THEN** the system SHALL fall back to enquirer prompt
- **AND** if enquirer is not feasible (no stdin), SHALL default to `react-ts` and proceed

### Requirement: Complete creation flow

The `create` command SHALL execute the full flow: validate name → select template → select bundler → render template files → write the chosen `@bundlekit/bundler-{bundler}` into the new project's `devDependencies` → install dependencies → invoke the framework plugin generator → install any pending dependencies → render the success view. In a TTY, the entire flow SHALL be presented as a step-based ink UI; in non-TTY, the flow SHALL execute non-interactively (or via enquirer fallback) with line-based logger output.

#### Scenario: Full creation flow succeeds in TTY
- **WHEN** user runs `bundlekit-cli create my-app --template react-ts --bundler vite` in a TTY
- **THEN** the cli SHALL render banner → loading steps with ink-spinner → final `<Done>` view with `cd my-app` and `pnpm dev` hints
- **AND** the new project files SHALL be generated correctly

#### Scenario: Full creation flow in non-TTY
- **WHEN** user runs `bundlekit-cli create my-app --template react-ts --bundler vite` in CI (non-TTY)
- **THEN** the cli SHALL execute without ink, log progress line by line via Logger
- **AND** SHALL exit with code 0 on success

#### Scenario: Bundler defaults when not specified
- **WHEN** user runs `bundlekit-cli create my-app --template react-ts` without `--bundler` in a TTY
- **THEN** the cli SHALL render the bundler `<SelectInput>` after the template step
- **AND** the chosen bundler SHALL be written into the new project's `devDependencies`
