## MODIFIED Requirements

### Requirement: Complete creation flow

The `create` command SHALL execute the full flow: validate name → select template → select bundler → render template files → write the chosen `@devkit/bundler-{bundler}` into the new project's `devDependencies` → install dependencies → invoke the framework plugin generator → install any pending dependencies → print success message and next-step hints.

#### Scenario: Full creation flow succeeds with bundler write-in
- **WHEN** user runs `devkit-cli create my-app --template react-ts --bundler vite`
- **THEN** files SHALL be generated in `./my-app`
- **AND** `./my-app/package.json` SHALL list `@devkit/bundler-vite` under `devDependencies`
- **AND** dependencies SHALL be installed in a single run (covering `@devkit/service`, `@devkit/bundler-vite`, framework plugin, and template runtime deps)
- **AND** the framework plugin generator SHALL run after install
- **AND** a success message including `cd my-app` and `pnpm dev` SHALL be printed

#### Scenario: Bundler defaults when not specified
- **WHEN** user runs `devkit-cli create my-app --template react-ts` without `--bundler`
- **AND** the user selects a bundler interactively
- **THEN** the chosen bundler SHALL be written into the new project's `devDependencies`
