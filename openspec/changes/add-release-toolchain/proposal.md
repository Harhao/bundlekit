## Why

项目已有 11 个 `@mail/` 包的 pnpm monorepo，但缺乏提交规范、版本管理、changelog 生成和代码质量门禁。随着包数量增长，无约束的提交历史会导致版本混乱、changelog 无法自动化、代码质量参差不齐，发包流程依赖人工记忆，风险高且不可复现。

## What Changes

- 引入 `commitlint` + Conventional Commits 规范，允许中文 subject，通过 git hook 强制执行
- 引入 `husky` 管理 git hooks（`commit-msg` + `pre-commit`）
- 引入 `lint-staged` 在 `pre-commit` 阶段只对暂存文件跑 ESLint fix + Prettier format
- 新增根目录 ESLint flat config（`eslint.config.mjs`），基于 `@typescript-eslint/recommended`
- 新增根目录 Prettier 配置（`.prettierrc`）
- 引入 `@changesets/cli` 管理独立包版本号 + 自动生成各包 `CHANGELOG.md`
- 新增两个 GitHub Actions workflow：`ci.yml`（PR 构建验证）和 `release.yml`（changesets 自动 Release PR + publish 占位）
- 新增 `.github/pull_request_template.md`

## Capabilities

### New Capabilities

- `commit-convention`: 通过 commitlint + husky commit-msg hook 强制 Conventional Commits 格式，支持中文 subject
- `pre-commit-hooks`: husky + lint-staged 对暂存文件执行 ESLint fix 和 Prettier format，阻断不符合规范的提交
- `code-quality`: 根目录 ESLint + Prettier 统一配置，作为各包的基础规则层
- `changeset-versioning`: `@changesets/cli` 驱动的独立包版本管理，开发者在 PR 前运行 `pnpm changeset` 声明变更
- `changelog-generation`: changesets version 命令自动更新各包 `CHANGELOG.md` 和 `package.json` version
- `release-automation`: GitHub Actions `ci.yml` 验证 PR 构建，`release.yml` 自动创建 Version PR 并提供 publish 占位

### Modified Capabilities

（无现有 spec 的需求变更）

## Impact

- **新增 devDependencies（根目录）**：`@commitlint/cli`、`@commitlint/config-conventional`、`husky`、`lint-staged`、`eslint`、`@typescript-eslint/eslint-plugin`、`@typescript-eslint/parser`、`prettier`、`@changesets/cli`
- **新增配置文件（根目录）**：`commitlint.config.mjs`、`.husky/commit-msg`、`.husky/pre-commit`、`eslint.config.mjs`、`.prettierrc`、`.prettierignore`、`.changeset/config.json`
- **新增 GitHub Actions**：`.github/workflows/ci.yml`、`.github/workflows/release.yml`、`.github/pull_request_template.md`
- **package.json scripts 变更**：新增 `lint`、`format`、`changeset`、`version-packages` 脚本
- **不影响现有构建产物和包 API**，纯工程配置层改动
