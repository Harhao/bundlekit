## ADDED Requirements

### Requirement: Commit message MUST follow Conventional Commits format
每次 git commit 的 message header SHALL 符合 `<type>(<scope>): <subject>` 格式，type 必须是允许列表之一，subject 长度 ≥ 2 个字符。Subject 允许中文。

允许的 type：`feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `chore` | `build` | `ci` | `revert`

#### Scenario: 合法的英文 subject commit 通过校验
- **WHEN** 提交 `feat(cli): add version command`
- **THEN** commitlint 校验通过，提交成功

#### Scenario: 合法的中文 subject commit 通过校验
- **WHEN** 提交 `feat(cli): 添加 version 命令`
- **THEN** commitlint 校验通过，提交成功

#### Scenario: 缺少 type 的 commit 被拒绝
- **WHEN** 提交 `add version command`（无 type 前缀）
- **THEN** commitlint 报错，提交被阻断，退出码非 0

#### Scenario: 不在允许列表的 type 被拒绝
- **WHEN** 提交 `update(cli): fix something`（update 不在 type 列表）
- **THEN** commitlint 报错，提交被阻断

#### Scenario: subject 为空或过短被拒绝
- **WHEN** 提交 `feat: ` 或 `fix(cli): x`（subject 少于 2 字符）
- **THEN** commitlint 报错，提交被阻断

### Requirement: commitlint 通过 husky commit-msg hook 自动触发
开发者在本地 `git commit` 时，系统 SHALL 自动运行 commitlint，无需手动执行。

#### Scenario: 安装依赖后 hook 自动就位
- **WHEN** 运行 `pnpm install`（触发 `prepare` 脚本）
- **THEN** `.husky/commit-msg` 文件存在且可执行

#### Scenario: CI 环境跳过 hook
- **WHEN** 在 `CI=true` 环境中运行 git 操作
- **THEN** husky hooks 自动跳过，不影响 CI 流程
