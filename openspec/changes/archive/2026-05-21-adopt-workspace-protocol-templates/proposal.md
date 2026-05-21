## Why

当前 cli 创建项目时卡在依赖安装步骤，根因是模板生成的 `package.json` 把 `@devkit/service` / `@devkit/plugin-react` / `@devkit/plugin-vue` 等内部包硬编码为固定语义化版本（`^0.0.1` / `^1.0.0`），但这些包**并未发布到 npm registry**，导致任何 `pnpm/npm/yarn install` 都会失败或长时间 hang。

业界对照（Rsbuild / Rspack / Modern.js 同类多打包器抽象项目）已经踩过这条坑，他们的做法是 **workspace 协议路径**（路径 D）：模板源码使用 `workspace:^`，monorepo 内 dev 时由 cli 替换为 `link:` 协议，发布到 npm 时由 pnpm 自动转换为具体版本号。这个模式是 pnpm 生态约定，跟着标准走可以零成本对接 changeset / pnpm publish 工具链。

同时项目还缺少：
- 给开发者贡献的引导文档（如何起本地 dev 环境、跑测试、加新 bundler / plugin）
- 完整的发版流程文档（changeset 工作流 + GitHub Actions 自动化 publish 配置）

本 change 一次性收掉这三件事，让 cli 创建流程立刻可用，给协作者一个完整的 onboarding 入口，给项目本身可以走 npm publish 的能力。

## What Changes

- **模板：4 个 `package.json.ejs` 把 `@devkit/*` 内部包改写为 `workspace:^`**
  - `template-react-ts/package.json.ejs`
  - `template-react-js/package.json.ejs`
  - `template-vue3-ts/package.json.ejs`
  - `template-vue3-js/package.json.ejs`
- **cli：`renderTemplates` 后新增"依赖版本规范化"步骤**
  - 检测当前 cwd 是否在 monorepo 内（`pnpm-workspace.yaml` + `packages/devkit-service` 双重判定）
  - 在 monorepo 内 → 把生成项目 package.json 的 `workspace:^` 替换为 `link:/abs/path/to/packages/devkit-{name}`
  - 在 monorepo 外 → 把 `workspace:^` 替换为 `^${cliVersion}`（lockstep 假设）
  - 生成时永远不让 `workspace:^` 字面量留在最终项目 package.json（用户机器上 pnpm/npm/yarn 任何包管理器都可解析）
- **cli：`addBundlerToDevDeps` 同样按依赖模式生成 `link:` 或 `^cliVersion`**
- **plugin 包：`@devkit/plugin-react` / `@devkit/plugin-vue` 版本归一**
  - 当前 plugin-react/plugin-vue 是 `1.0.0`，其余 `0.0.1`，违反 lockstep 假设
  - 统一降到 `0.0.1` 与 cli/service/bundler-* 保持同步（首次发版时由 changeset 一并 bump 到 `0.1.0`）
- **docs：新增开发者贡献文档**
  - `docs/contributing/index.md`：贡献流程总览
  - `docs/contributing/setup.md`：本地 dev 环境搭建
  - `docs/contributing/testing.md`：unit / integration / e2e 测试矩阵
  - `docs/contributing/adding-bundler.md`：如何新增 bundler 适配器
  - `docs/contributing/adding-plugin.md`：如何新增构建 plugin
  - `docs/contributing/release.md`：changeset + GitHub Actions 发版流程
  - `.dumirc.ts` 增加导航入口与 sidebar 配置
- **docs：现有 guide 同步更新**
  - `docs/guide.md` 添加"快速开始"section，明确 monorepo dev / 全局 cli 两条路径
  - `docs/guide/cli.md` 加入"为什么生成的 package.json 含 link:"说明
- **CI：完善 `.github/workflows/publish-npm.yml` 与 changeset 配置**
  - `baseBranch` 修正为 `master`（与现 workflow 监听一致）
  - 加 `NPM_TOKEN` secret 引用 + 配置说明
  - 加 GH `GITHUB_TOKEN` 权限
  - publish 之前加 `pnpm test && pnpm test:integration` 步骤
  - 文档中说明仓库 secrets 配置步骤
- **changeset：补对应 release notes**

## Capabilities

### New Capabilities

- `template-version-injection`：模板生成时按运行环境（monorepo 内 / 外）注入正确的依赖版本（`link:` / `^version`），完全替代旧的硬编码版本
- `developer-onboarding-docs`：开发者贡献文档体系（环境搭建 / 测试 / 扩展点 / 发版）
- `release-pipeline`：基于 changeset + GitHub Actions 的自动化 npm 发版流程

### Modified Capabilities

- `cli-create`：模板渲染流程加入"依赖版本规范化"子步骤，generated `package.json` 不会再含 `^0.0.1` 这种硬编码版本

## Impact

- **代码**：
  - `packages/devkit-cli/lib/utils/projectMutation.ts`：新增 `findMonorepoRoot` / `resolveDepMode` / 替换 helper
  - `packages/devkit-cli/lib/commands/create/actions.ts`：`renderTemplates` 后调依赖规范化
  - `packages/devkit-cli/lib/commands/create/creator.ts`：legacy 路径同款
  - 4 个 `package.json.ejs` 模板
  - `packages/devkit-plugin-react/package.json` 版本归一
  - `packages/devkit-plugin-vue/package.json` 版本归一
- **文档**：
  - `packages/devkit-docs/docs/contributing/`（新目录，6 个文件）
  - `packages/devkit-docs/.dumirc.ts`（导航 + sidebar）
  - `packages/devkit-docs/docs/guide.md` / `cli.md` 内容更新
- **CI**：
  - `.github/workflows/publish-npm.yml` 完善
  - `.changeset/config.json` `baseBranch` 修正
- **API**：
  - `installDeps(opts)` / `addBundlerToDevDeps` 签名扩展接受 depMode 参数
- **依赖**：无新 npm 包
- **环境变量**：新增 `DEVKIT_DEP_MODE` / `DEVKIT_MONOREPO_ROOT` 旁路（CI 友好）
- **不影响**：service runtime / bundler adapters / SSR 路径
