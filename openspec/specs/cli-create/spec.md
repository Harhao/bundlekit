# cli-create Specification

## Purpose
TBD - created by archiving change cli-scaffolding. Update Purpose after archive.
## Requirements
### Requirement: Validate project name
The `create` command SHALL validate the project name: it must be a non-empty, valid npm package name, and must not conflict with an existing directory.

#### Scenario: Valid project name
- **WHEN** user runs `bundlekit-cli create my-app`
- **THEN** the system SHALL proceed with project creation

#### Scenario: Existing directory conflict
- **WHEN** user runs `bundlekit-cli create my-app` and `./my-app` already exists
- **THEN** the system SHALL display an error and exit

#### Scenario: Invalid package name
- **WHEN** user runs `bundlekit-cli create "My App"` (contains space)
- **THEN** the system SHALL display an error about invalid package name

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
The `create` command SHALL execute the full flow: validate name → select template → select bundler → select package manager → enter description → generate files → write bundler to devDependencies → install dependencies (using selected PM) → invoke framework generator → print success message with PM-aware startup commands.

#### Scenario: Full creation flow succeeds with pnpm
- **WHEN** user runs `bundlekit-cli create my-app -t react-ts -b vite --pm pnpm`
- **THEN** files SHALL be generated in `./my-app`
- **AND** `@bundlekit/bundler-vite` SHALL be added to `devDependencies`
- **AND** dependencies SHALL be installed with pnpm
- **AND** the success message SHALL include `cd my-app && pnpm dev`

#### Scenario: Full creation flow with all interactive prompts
- **WHEN** user runs `bundlekit-cli create my-app` and answers all prompts (template=react-ts, bundler=vite, pm=pnpm, description="demo")
- **THEN** the same outcome as the flag-driven scenario SHALL hold
- **AND** the user SHALL have been prompted in order: template → bundler → pm → description

### Requirement: Description input requires explicit submit
The `create` command's interactive description step SHALL only advance to the next step when the user explicitly presses Enter; typing characters into the description input SHALL NOT cause step advancement, regardless of input value.

#### Scenario: Typing without Enter stays on description step
- **WHEN** user is on the description step
- **AND** user types `"a"` in the input
- **THEN** the system SHALL remain on the description step
- **AND** the input SHALL display the typed value

#### Scenario: Empty submit advances to next step
- **WHEN** user is on the description step
- **AND** user presses Enter without typing anything
- **THEN** the system SHALL advance to the next step (tasks)
- **AND** the description SHALL be treated as empty (rendered as a single space in template context)

#### Scenario: Description provided via flag skips step entirely
- **WHEN** user runs `bundlekit-cli create my-app -t react-ts -b vite -d "demo"`
- **THEN** the system SHALL NOT display the description step
- **AND** the description value SHALL be `"demo"`

### Requirement: Bundler selection list is layered
The `create` command's interactive bundler step SHALL present a primary list containing `vite`, `webpack`, `rspack` and a "more bundlers" entry that, when selected, switches to a secondary list containing `rollup`, `rolldown`, and a back entry. The `-b` flag SHALL bypass the layered UI and accept any of the five values directly.

#### Scenario: Primary list rendered by default
- **WHEN** user reaches the bundler step without `-b` flag
- **THEN** the rendered list SHALL contain `vite`, `webpack`, `rspack`, and `更多打包器 →`
- **AND** the list SHALL NOT directly display `rollup` or `rolldown`

#### Scenario: Expanding to secondary list
- **WHEN** user selects `更多打包器 →` in the primary list
- **THEN** the rendered list SHALL switch to `rollup`, `rolldown`, and `← 返回`
- **AND** keyboard arrow keys SHALL navigate the secondary list

#### Scenario: Returning from secondary to primary
- **WHEN** user selects `← 返回` in the secondary list
- **OR** user presses Esc / Backspace on the secondary list
- **THEN** the system SHALL switch back to the primary list

#### Scenario: Direct flag accepts any bundler
- **WHEN** user runs `bundlekit-cli create my-app -b rolldown`
- **THEN** the system SHALL skip the bundler step entirely and use `rolldown`

### Requirement: Package manager selection step
The `create` command SHALL include a package manager selection step between the bundler step and the description step, where the user picks among `pnpm`, `yarn`, `npm`. The default order SHALL be `pnpm` > `yarn` > `npm`. Package managers not detected on the system PATH SHALL be displayed as disabled (greyed out and labeled `(未安装)`) and SHALL NOT be selectable.

#### Scenario: All three package managers available
- **WHEN** the system detects `pnpm`, `yarn`, and `npm` all on PATH
- **THEN** the rendered list SHALL contain all three options enabled
- **AND** `pnpm` SHALL be the initial focus

#### Scenario: Yarn not installed
- **WHEN** the system fails to detect `yarn` on PATH
- **THEN** the `yarn` option SHALL be displayed dimmed with a `(未安装)` suffix
- **AND** the user SHALL be unable to select `yarn`

#### Scenario: --pm flag bypasses prompt
- **WHEN** user runs `bundlekit-cli create my-app --pm yarn`
- **THEN** the system SHALL skip the PM step
- **AND** subsequent install commands SHALL be invoked with yarn

#### Scenario: DEVKIT_PM environment variable bypass
- **WHEN** environment variable `DEVKIT_PM=npm` is set
- **AND** user runs `bundlekit-cli create my-app` (no `--pm` flag)
- **THEN** the system SHALL skip the PM step and use npm

#### Scenario: --pm flag overrides environment variable
- **WHEN** environment variable `DEVKIT_PM=npm` is set
- **AND** user runs `bundlekit-cli create my-app --pm pnpm`
- **THEN** the system SHALL use pnpm

### Requirement: Selected package manager drives install and Done view
The selected package manager SHALL be passed to `installDeps` to enforce its use during dependency installation, and the `Done` view SHALL render startup commands matching the selected PM (`pnpm dev` / `yarn dev` / `npm run dev`).

#### Scenario: pnpm selected
- **WHEN** the user selects `pnpm`
- **THEN** `installDeps` SHALL invoke pnpm
- **AND** the Done view SHALL display `pnpm dev` and `pnpm build` as next steps

#### Scenario: npm selected
- **WHEN** the user selects `npm`
- **THEN** `installDeps` SHALL invoke npm
- **AND** the Done view SHALL display `npm run dev` and `npm run build` as next steps

### Requirement: Generated package.json scripts are minimal
Project templates (`template-react-ts`, `template-react-js`, `template-vue3-ts`, `template-vue3-js`) SHALL generate a `package.json` with exactly three scripts: `clean`, `dev`, `build`. Bundler-specific aliases such as `${bundler}:dev` / `${bundler}:prod` SHALL NOT be generated.

#### Scenario: react-ts template scripts
- **WHEN** user runs `bundlekit-cli create my-app -t react-ts -b vite`
- **THEN** the generated `my-app/package.json` `scripts` field SHALL contain exactly three keys: `clean`, `dev`, `build`
- **AND** the field SHALL NOT contain `vite:dev` or `vite:prod`

#### Scenario: vue3-js template scripts
- **WHEN** user runs `bundlekit-cli create my-app -t vue3-js -b webpack`
- **THEN** the generated `my-app/package.json` `scripts` field SHALL contain exactly three keys: `clean`, `dev`, `build`
- **AND** the field SHALL NOT contain `webpack:dev` or `webpack:prod`

### Requirement: Dependency mode resolution
The `create` command SHALL always use npm registry mode for dependency resolution. The `@bundlekit/*` dependencies in the generated `package.json` SHALL use `^cliVersion` format (e.g., `^0.0.1`). The `link:` protocol SHALL NOT be used.

#### Scenario: npm mode used in monorepo
- **WHEN** user runs `bundlekit-cli create my-app` inside a monorepo
- **THEN** the generated `package.json` SHALL contain `@bundlekit/*` dependencies with `^cliVersion` format
- **AND** no `link:` protocol values SHALL appear in any dependency field

#### Scenario: npm mode used outside monorepo
- **WHEN** user runs `bundlekit-cli create my-app` outside any monorepo
- **THEN** the generated `package.json` SHALL contain `@bundlekit/*` dependencies with `^cliVersion` format

#### Scenario: DEVKIT_DEP_MODE=link silently degrades
- **WHEN** environment variable `DEVKIT_DEP_MODE=link` is set
- **AND** user runs `bundlekit-cli create my-app`
- **THEN** the system SHALL use npm registry mode (not link mode)
- **AND** no error or warning SHALL be displayed

#### Scenario: Zero workspace: literals
- **WHEN** the `create` command completes dependency normalization
- **THEN** the generated `package.json` SHALL contain zero `workspace:` literals in any dependency field

