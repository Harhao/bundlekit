## ADDED Requirements

### Requirement: Contributing documentation index
The documentation site SHALL include a `contributing` section accessible from the top navigation, with an index page that overviews the contribution lifecycle: fork → branch → develop → test → PR → review → release.

#### Scenario: Top navigation contains 贡献 entry
- **WHEN** a visitor opens any documentation page
- **THEN** the top navigation SHALL contain a "贡献" entry linking to `/contributing`

#### Scenario: Index page lists subsections
- **WHEN** a visitor opens `/contributing`
- **THEN** the page SHALL link to: 环境搭建、运行测试、新增 bundler、新增 plugin、发版流程

### Requirement: Local development setup guide
A `setup.md` page SHALL document the steps to set up a local development environment: clone the repo, install pnpm, run `pnpm install`, run `pnpm build:all`, common scripts, and how to run a single package's dev/build script.

#### Scenario: Setup page covers prerequisites
- **WHEN** a visitor opens `/contributing/setup`
- **THEN** the page SHALL list Node ≥ 18, pnpm ≥ 8 prerequisites
- **AND** the page SHALL include the exact `pnpm install` and `pnpm build:all` commands

#### Scenario: Setup page covers per-package scripts
- **WHEN** the visitor reaches the "包级脚本" section
- **THEN** examples SHALL include `pnpm --filter @bundlekit/cli run cli:build` and similar for service / shared-utils / bundler-*

### Requirement: Testing documentation
A `testing.md` page SHALL document the three-tier test infrastructure (unit / integration / e2e), how to run each, when to add what, and the Playwright browser installation step.

#### Scenario: Testing matrix shown
- **WHEN** a visitor opens `/contributing/testing`
- **THEN** the page SHALL list the three commands: `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`
- **AND** the page SHALL describe the bundler × mode matrix covered by integration tests

#### Scenario: Playwright install instructions
- **WHEN** a contributor wants to run e2e tests
- **THEN** the page SHALL provide `pnpm playwright install chromium` as the prerequisite step

### Requirement: Adding a new bundler adapter
An `adding-bundler.md` page SHALL document how to extend the project with a new bundler adapter, covering: the `IBuildToolAdapter` interface, registering the adapter in `BUNDLER_PACKAGE_MAP`, implementing `transformConfig` / `run` / `createSSRMiddleware`, and adding integration test fixtures.

#### Scenario: Interface contract documented
- **WHEN** a contributor reads `/contributing/adding-bundler`
- **THEN** the page SHALL show the `IBuildToolAdapter` TypeScript interface with all required and optional methods

#### Scenario: Step-by-step example
- **WHEN** the contributor follows the page
- **THEN** the steps SHALL include: create `packages/bundlekit-bundler-<name>/`, implement adapter class, register in `BUNDLER_PACKAGE_MAP`, add `__tests__/integration/fixtures/<name>/` with three `.bundlekitrc.<mode>.ts` files

### Requirement: Adding a new framework plugin
An `adding-plugin.md` page SHALL document how to add a new framework plugin (analogous to `@bundlekit/plugin-react` / `@bundlekit/plugin-vue`), covering: PluginAPI usage, the `framework` field convention, template directory structure, and generator hooks.

#### Scenario: Plugin API usage
- **WHEN** a contributor reads `/contributing/adding-plugin`
- **THEN** the page SHALL describe `apply(api, config)` signature and the `api.modifyBuildConfig` method

#### Scenario: Template structure documented
- **WHEN** the contributor wants to ship templates with the plugin
- **THEN** the page SHALL describe the convention `packages/bundlekit-plugin-<name>/templates/template-<name>-<lang>/` with EJS files

### Requirement: Release documentation
A `release.md` page SHALL document the complete release flow: changeset creation, version bumping via changesets/action, PR review, merge-triggered npm publish, and required GitHub secrets configuration.

#### Scenario: Changeset workflow
- **WHEN** a contributor reads `/contributing/release`
- **THEN** the page SHALL show the `pnpm changeset` interactive flow and how to write the markdown summary

#### Scenario: GitHub Actions secrets
- **WHEN** a maintainer prepares the repo for first release
- **THEN** the page SHALL list required secrets: `NPM_TOKEN` (npm Automation token, scope `@bundlekit`), `GITHUB_TOKEN` (auto-provided by GitHub)
- **AND** the page SHALL include step-by-step screenshots or commands to obtain and set these secrets

#### Scenario: Auto-publish on merge
- **WHEN** a "Version Packages" PR (auto-created by changesets/action) is merged into master
- **THEN** the page SHALL describe how the workflow automatically runs `pnpm changeset publish` to push tarballs to npm
