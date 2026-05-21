## ADDED Requirements

### Requirement: Changeset config aligned with release branch
The `.changeset/config.json` `baseBranch` field SHALL match the GitHub Actions workflow's monitored branch (`master`). Misalignment causes changesets to compute wrong diffs and prevents auto-versioning PRs from being created.

#### Scenario: baseBranch consistent with workflow
- **WHEN** inspecting `.changeset/config.json`
- **THEN** `baseBranch` SHALL be `"master"`
- **AND** `.github/workflows/publish-npm.yml` `on.push.branches` SHALL include `master`

### Requirement: Publish workflow includes test gates
The `publish-npm.yml` workflow SHALL run `pnpm test` and `pnpm test:integration` before invoking `changesets/action`. Test failures SHALL block publishing.

#### Scenario: Tests run before publish
- **WHEN** the workflow is triggered by a push to master
- **THEN** the job sequence SHALL be: checkout → setup pnpm/node → install → build → test → test:integration → changesets/action

#### Scenario: Test failure blocks publish
- **WHEN** any test step exits non-zero
- **THEN** the workflow SHALL stop and the publish step SHALL NOT run

### Requirement: NPM_TOKEN secret integration
The `publish-npm.yml` workflow SHALL pass an `NPM_TOKEN` secret as an environment variable to the `changesets/action` step. The repository documentation SHALL describe how to generate and configure this token.

#### Scenario: Workflow references NPM_TOKEN
- **WHEN** inspecting the changesets/action step
- **THEN** the step SHALL include:
  ```
  env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
  ```

#### Scenario: Setup documented in release.md
- **WHEN** a maintainer reads `/contributing/release`
- **THEN** the page SHALL include the steps: generate npm Automation token, configure as repo secret named `NPM_TOKEN`, verify with a test run

### Requirement: Release-ready package metadata
Every `@devkit/*` package intended for npm publication SHALL declare `publishConfig.registry` pointing to the public npm registry, and SHALL declare appropriate `files` / `main` / `module` / `types` fields so the published tarball contains only `dist/` artifacts.

#### Scenario: publishConfig set
- **WHEN** scanning `@devkit/cli`, `@devkit/service`, `@devkit/shared-utils`, `@devkit/bundler-*`, `@devkit/plugin-*` package.json files
- **THEN** each SHALL contain `"publishConfig": { "registry": "https://registry.npmjs.org/" }`

#### Scenario: Files allowlist excludes source
- **WHEN** running `npm pack --dry-run` against any `@devkit/*` package
- **THEN** the resulting tarball file list SHALL NOT include `src/`, `lib/`, or `__tests__/`
- **AND** SHALL include `dist/` and `package.json`

### Requirement: Lockstep version uniformity
All publishable `@devkit/*` packages SHALL use the same starting version number prior to first npm release, satisfying the lockstep assumption used by `addBundlerToDevDeps` and template version normalization.

#### Scenario: Pre-release version uniform
- **WHEN** scanning `@devkit/cli`, `@devkit/service`, `@devkit/shared-utils`, `@devkit/bundler-*`, `@devkit/plugin-react`, `@devkit/plugin-vue` `package.json` `version` fields prior to the first changeset publish
- **THEN** all SHALL equal `"0.0.1"`

#### Scenario: First release uses changeset
- **WHEN** the maintainer triggers the first npm release
- **THEN** changeset SHALL bump all uniform packages together to `0.1.0` (minor)
- **AND** the GH Action SHALL publish all of them as `0.1.0` to the npm registry
