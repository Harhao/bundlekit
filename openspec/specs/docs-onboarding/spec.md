# docs-onboarding Specification

## Purpose
TBD - created by archiving change docs-installation-flow. Update Purpose after archive.
## Requirements
### Requirement: Quick Start uses scaffold-first

The onboarding documentation (`docs/index.md` Hero, `docs/guide.md` Quick Start, `README.md`) SHALL present `npx @devkit/cli create my-app` as the primary, recommended quick-start command before any other install instruction.

#### Scenario: Index page Quick Start
- **WHEN** a reader opens `docs/index.md`
- **THEN** the first executable command in Quick Start SHALL be `npx @devkit/cli create my-app`

#### Scenario: README Quick Start
- **WHEN** a reader opens `README.md`
- **THEN** the first executable command in Quick Start SHALL be `npx @devkit/cli create my-app`

### Requirement: Two integration paths documented

The `docs/guide.md` page SHALL present two distinct integration paths: scaffold-first (recommended) and manual-integration (existing projects). Each path SHALL be presented as numbered, copy-pasteable steps.

#### Scenario: Scaffold-first path documented
- **WHEN** a reader navigates to "方式一：脚手架创建"
- **THEN** the page SHALL list at least three steps culminating in `cd my-app && pnpm dev`
- **AND** SHALL note that the cli auto-installs `@devkit/service`, framework plugin, and chosen bundler into devDependencies

#### Scenario: Manual-integration path documented
- **WHEN** a reader navigates to "方式二：现有项目接入"
- **THEN** the page SHALL list steps including `pnpm add -D @devkit/service @devkit/plugin-react` and `dc add bundler-<name>`
- **AND** SHALL show how to author a minimal `.devkitrc.ts`

### Requirement: CLI documentation reflects new behaviors

The `docs/guide/cli.md` page SHALL document the bundler short-name table for `dc add`, the runtime bundler-missing prompt behavior, the ink-based UI with `DEVKIT_NO_INK` fallback, and the `DEVKIT_AUTO_INSTALL` environment variable.

#### Scenario: Bundler short-name table
- **WHEN** a reader views the `dc add` section
- **THEN** the page SHALL list `bundler-webpack`, `bundler-vite`, `bundler-rspack`, `bundler-rollup`, `bundler-rolldown` along with their full package names

#### Scenario: Runtime prompt described
- **WHEN** a reader views the cli reference
- **THEN** the page SHALL describe what happens when `devkit-service serve --bundler X` is invoked while X is not installed (yes/no prompt, install written to devDependencies, decline → exit 1)
- **AND** SHALL document `DEVKIT_AUTO_INSTALL=1` as the CI bypass

#### Scenario: Ink UI screenshot or ASCII diagram
- **WHEN** a reader views the cli reference
- **THEN** the page SHALL include an ASCII representation or SVG screenshot of the ink-rendered create flow
- **AND** SHALL note `DEVKIT_NO_INK=1` and non-TTY fallback

### Requirement: Config reference covers tools and ssr

The `docs/guide/config.md` page SHALL include a "tools (逃生舱)" section with at least one example per bundler, and an "SSR" section that documents every field of the `ssr` config block.

#### Scenario: Tools example per bundler
- **WHEN** a reader views the config reference
- **THEN** the page SHALL include `tools.webpack`, `tools.vite`, `tools.rspack`, `tools.rollup`, `tools.rolldown` with at least one minimal example each
- **AND** SHALL clarify the call order: `transformConfig → tools → changeConfigure → run`

#### Scenario: SSR fields documented
- **WHEN** a reader views the config reference
- **THEN** the `ssr` field SHALL be documented with all sub-fields (`entry`, `output`, `externals`, `template`, `placeholder`)

### Requirement: Dedicated SSR guide exists

A new page `docs/guide/ssr.md` SHALL exist providing: architecture diagram, entry conventions (`entry-client.tsx` + `entry-server.tsx`), build vs dev behavior, HMR support matrix per bundler, and a migration example for an existing CSR project.

#### Scenario: SSR guide reachable from sidebar
- **WHEN** a reader navigates the docs site
- **THEN** "SSR 指南" SHALL appear in the guide sidebar

#### Scenario: HMR matrix present
- **WHEN** a reader views the SSR guide
- **THEN** a table SHALL show client HMR / server HMR support per bundler (vite ✅✅, webpack ✅⚠️, rspack ✅⚠️, rollup ❌❌, rolldown ❌❌)

### Requirement: Architecture page reflects updated dependency graph

The `docs/guide/architecture.md` page's "模块依赖关系" diagram SHALL show that `@devkit/service` no longer depends on `@devkit/bundler-*` packages, and the "运行时动态加载打包器" section SHALL describe the new install-with-consent behavior.

#### Scenario: Updated dependency diagram
- **WHEN** a reader views the architecture diagram
- **THEN** the diagram SHALL NOT show `service → bundler-*` as a dependency arrow
- **AND** SHALL show bundler-* as project-level devDependencies installed by cli or runtime prompt

#### Scenario: Runtime install description updated
- **WHEN** a reader views "运行时动态加载打包器" section
- **THEN** the description SHALL state "find-or-prompt-or-fail" semantics, not the old "find-or-silently-install" semantics

