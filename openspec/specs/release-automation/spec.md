# release-automation Specification

## Purpose
TBD - created by archiving change add-release-toolchain. Update Purpose after archive.
## Requirements
### Requirement: PR CI workflow 在 PR 合并前验证 typecheck 和构建
系统 SHALL 提供 `.github/workflows/ci.yml`，在向 `main` 分支发起 PR 时自动运行：安装依赖（`pnpm install --frozen-lockfile`）→ 类型检查（`tsc --noEmit`）→ 构建（`turbo run service:build`）。任一步骤失败则 workflow 失败，阻断合并。

#### Scenario: PR 创建时触发 CI
- **WHEN** 向 main 分支开 PR 或推送新 commit
- **THEN** GitHub Actions 自动触发 `ci.yml` workflow

#### Scenario: 构建失败阻断合并
- **WHEN** `turbo run service:build` 返回非 0 退出码
- **THEN** CI workflow 标记失败，PR 状态检查不通过

#### Scenario: 所有步骤通过则 CI 绿色
- **WHEN** typecheck 和 build 均成功
- **THEN** workflow 成功完成，PR 状态检查通过

### Requirement: Release workflow 自动创建 Version Packages PR
系统 SHALL 提供 `.github/workflows/release.yml`，在 push 到 `main` 分支时，通过 `changesets/action` 检测未处理的 changeset 文件：若存在则自动创建或更新标题为 "Version Packages" 的 PR，PR 内容为所有受影响包的版本升级和 CHANGELOG 更新。

#### Scenario: push 到 main 后有 changeset 文件触发 Version PR
- **WHEN** 包含 changeset 文件的 commit 被 push 到 main
- **THEN** `release.yml` 运行，仓库中出现 "Version Packages" PR

#### Scenario: 无 changeset 文件时不创建 PR
- **WHEN** push 到 main 的 commit 不含 changeset 文件
- **THEN** `release.yml` 运行但不创建新 PR

### Requirement: release workflow 的 publish 步骤为注释占位
`release.yml` 中 publish 相关步骤 SHALL 存在但以注释形式保留，注释中标注 `TODO: 配置 NPM_TOKEN secret 后取消注释`，不实际执行发包。

#### Scenario: release workflow 无 NPM_TOKEN 时不报错
- **WHEN** 仓库 Secrets 中未配置 `NPM_TOKEN`
- **THEN** `release.yml` 正常运行（publish 步骤被注释，不执行），workflow 不因缺少 secret 而失败

### Requirement: PR template 提醒检查 changeset
系统 SHALL 提供 `.github/pull_request_template.md`，包含 checklist 项：`[ ] 已运行 pnpm changeset（如有包变更）`。

#### Scenario: PR template 在新建 PR 时自动填充
- **WHEN** 在 GitHub 上新建 PR
- **THEN** PR 描述框自动填入 `.github/pull_request_template.md` 的内容

