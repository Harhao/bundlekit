# changeset-versioning Specification

## Purpose
TBD - created by archiving change add-release-toolchain. Update Purpose after archive.
## Requirements
### Requirement: 开发者可通过 `pnpm changeset` 声明变更
系统 SHALL 提供 `@changesets/cli`，使开发者能在 PR 前运行 `pnpm changeset`，交互式选择受影响的包、semver 级别（patch/minor/major）和变更描述，生成 `.changeset/*.md` 文件。

#### Scenario: 运行 changeset 命令成功
- **WHEN** 运行 `pnpm changeset`
- **THEN** 交互式 CLI 启动，列出所有 `@devkit/` 包供选择

#### Scenario: changeset 文件生成正确
- **WHEN** 完成 changeset 交互，选择 `@devkit/cli` patch 级别
- **THEN** `.changeset/` 目录下生成一个 `.md` 文件，frontmatter 包含 `"@devkit/cli": patch`

### Requirement: changesets 配置指定独立版本模式
`.changeset/config.json` SHALL 包含：
- `"linked": []`（无联动包，完全独立版本）
- `"access": "restricted"`（私有包）
- `"baseBranch": "main"`
- `"updateInternalDependencies": "patch"`（内部依赖自动升 patch）
- `"changelog": "@changesets/cli/changelog"`

#### Scenario: config.json 存在且可被 changeset 工具读取
- **WHEN** 运行 `pnpm changeset status`
- **THEN** 命令正常执行，无配置读取错误

### Requirement: `pnpm version-packages` 命令根据 changeset 文件更新版本
系统 SHALL 在根目录 `package.json` 的 `scripts` 中包含 `version-packages` 脚本，运行 `changeset version`，自动更新受影响包的 `package.json` version 字段并清除已处理的 changeset 文件。

#### Scenario: version 命令更新包版本
- **WHEN** `.changeset/` 目录中有 changeset 文件，运行 `pnpm version-packages`
- **THEN** 对应包的 `package.json` version 字段被更新，changeset 文件被删除

