## Context

bundlekit 是一个 pnpm workspace monorepo，包含 11 个 `@bundlekit/` scoped 包（bundlekit-cli、bundlekit-service、bundlekit-bundler-*、bundlekit-plugin-*），使用 Turborepo 编排构建任务，发布到内部私有 npm registry（`https://registry.example.com/`）。

当前工程状态：无 git hooks、无 lint/format 配置、无 commit 格式约束、无 changelog、版本号全部停留在 `0.0.1`，发包流程完全手动。本次改动是纯工程配置层，不涉及任何包 API 或构建产物变更。

## Goals / Non-Goals

**Goals:**
- 统一 commit 格式（Conventional Commits，支持中文 subject）
- pre-commit 阶段自动 lint fix + format，阻断不合规提交
- `@changesets/cli` 驱动独立包版本管理和 CHANGELOG 生成
- GitHub Actions：PR 构建验证 + changesets Release PR 自动化
- 给 publish 留占位（token 后续配置）

**Non-Goals:**
- 不引入单元测试框架（独立任务）
- 不修改现有构建脚本和包输出
- 不迁移现有 commit history 到新格式
- 不立即接通内部 registry 的 CI 自动发包（留占位）

## Decisions

### D1：版本管理选 Changesets 而非 release-it

**选择**：`@changesets/cli`

**理由**：项目已经从 Lerna 迁移到 Turbo，不回头。release-it 对 monorepo 独立版本的支持依赖插件且较弱。Changesets 是 pnpm monorepo 的事实标准，`changesets/action` 提供成熟的 Release PR 模式，changelog 内容由开发者手写描述（质量高），而非完全依赖 commit message。

**备选**：release-it + @release-it/conventional-changelog — 全自动但 changelog 质量依赖 commit 纪律，monorepo 独立版本支持需要额外插件。

### D2：commitlint 配置基于 `config-conventional`，放宽 subject-case

**选择**：`@commitlint/config-conventional` + 覆盖 `subject-case: [0]` 和 `subject-full-stop: [0]`

**理由**：允许中文 subject（`feat(cli): 添加 version 命令`），不强制 lower-case，不强制句尾无标点。type 和 header 格式仍严格校验。scope 取包名简写（cli、service、bundler-vite 等），可省略。

**备选**：`config-angular` 规则更严，但不友好于中文，排除。

### D3：ESLint 使用 flat config（v9）

**选择**：`eslint.config.mjs`（ESLint flat config）+ `@typescript-eslint/eslint-plugin`

**理由**：ESLint v9+ 默认使用 flat config，TypeScript ESLint 生态已全面迁移。旧式 `.eslintrc` 在 v9 中已废弃。各包可在自己目录下扩展根 config。

**备选**：`.eslintrc.cjs`（legacy config）— 未来会被移除，不选。

### D4：Prettier 独立配置，不通过 ESLint 运行

**选择**：Prettier 独立跑（lint-staged 分别执行 `eslint --fix` 和 `prettier --write`）

**理由**：`eslint-plugin-prettier` 会把格式错误变成 ESLint error，使 lint 输出嘈杂。分离关注点：ESLint 管逻辑质量，Prettier 管格式，两者互不干扰。用 `eslint-config-prettier` 关闭 ESLint 中与 Prettier 冲突的格式规则。

### D5：GitHub Actions release workflow 中 publish job 注释占位

**选择**：`release.yml` 的 publish step 用注释标记 `# TODO: 配置 NPM_TOKEN secret 后取消注释`

**理由**：内部 registry token 需要单独申请，当前无法配置。Release PR 自动化（changeset version）可以先跑通，publish 部分等 token 就绪后一行注释解除即可。

## Risks / Trade-offs

- **[风险] 开发者忘记运行 `pnpm changeset`** → 合并 Release PR 时不会包含该包的版本更新；缓解：PR template checklist 提醒，CI 可加 `changeset status --since=origin/main` 检查
- **[风险] husky 在 CI 环境执行失败** → husky v9 在 `CI=true` 环境下自动跳过 hooks，不影响 CI；本地开发者需要 `pnpm install` 后 husky 自动 prepare
- **[风险] ESLint flat config 与现有工具链不兼容** → 各包暂无 ESLint 配置，根目录 flat config 仅覆盖 `packages/**/*.ts`，不影响构建；如有冲突可在包级别用 `ignores` 跳过
- **[Trade-off] Changesets 需要开发者额外操作** → 换来的是高质量、可读的 changelog 和明确的版本意图，对于工具类库（发包给其他团队使用）这个代价值得

## Migration Plan

1. 安装所有 devDependencies，初始化 husky（`pnpm prepare`）
2. 现有 commit 历史不做清洗，commitlint 只对新提交生效
3. 各包初始版本保持不变（`0.0.1` / `1.0.0`），第一次 `pnpm changeset` + `pnpm version-packages` 后才会更新
4. GitHub Actions secrets（`GITHUB_TOKEN` 用于 Release PR，`NPM_TOKEN` 占位）在仓库 Settings > Secrets 中配置

## Open Questions

- 内部 registry token 的申请流程和 secret 名称（当前 `NPM_TOKEN` 仅为占位命名）
- 是否需要在 PR CI 中加 `changeset status` 检查（强制要求每个 PR 有 changeset 文件）
