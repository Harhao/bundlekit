## Why

`@bundlekit/docs` 的 onboarding 文档（`docs/index.md`、`docs/guide.md`、`docs/guide/cli.md`）目前给出的安装命令是：

```bash
pnpm add -D @bundlekit/service @bundlekit/cli
```

这条命令暗示用户**先在某个项目里**装两个包，但实际推荐的"心智模型"是 cli 先行（全局或 npx），由 cli 创建项目并自动写入 `@bundlekit/service` + `@bundlekit/bundler-X` 到新项目的 `devDependencies`。当 change 1 / 4 落地后，老文档与真实行为之间的差距会更大（cli 创建出来的 devDeps 多一项 bundler-*，runtime prompt 行为也需要说明）。

本 change 的目标是把 4 个代码 change 的产出**汇总到 onboarding 文档**中，让用户从"零到能跑"的心智清晰一致。

## What Changes

- 重写 `docs/index.md` 与 `docs/guide.md` 的"安装"章节：
  - 推荐流：`npx @bundlekit/cli create my-app` 一条命令（cli 自动装 service / plugin / bundler）
  - 手工集成流：现有项目里 `pnpm add -D @bundlekit/service @bundlekit/plugin-react`，再 `dc add bundler-vite`
  - 全局安装可选项：`pnpm add -g @bundlekit/cli`
- 修订 `docs/guide/cli.md`：
  - `add` 命令章节加 `bundler-*` 短名表（来自 change 1）
  - 加 ink UI 截图与 `DEVKIT_NO_INK` fallback 说明（来自 change 4）
  - 加运行时 bundler 缺失时的 yes/no prompt 说明（来自 change 1）
- 修订 `docs/guide/config.md`：
  - 增加"逃生舱（tools）"章节，给出 5 个 bundler 的最小用例（来自 change 2）
  - 增加 `ssr` 字段说明（来自 change 3）
- 修订 `docs/guide/bundlers.md`：
  - 顶部加"Bundler 安装方式"小节
  - 增加"SSR 支持矩阵"小节（来自 change 3）
- 新增 `docs/guide/ssr.md`：完整 SSR 指南（架构、入口约定、build vs dev、HMR 矩阵、迁移指南）
- 修订 `docs/guide/architecture.md`：在"模块依赖关系"中反映 service 不再依赖 bundler-* 的新结构（来自 change 1）
- 在 `README.md` 顶部 Quick Start 同步更新

## Capabilities

### New Capabilities
- `docs-onboarding`: 描述 onboarding 文档需要满足的内容契约 — 安装流程、命令矩阵、运行时行为说明的一致性。

### Modified Capabilities
（无 — 本 change 不改变现有 capability 行为，仅文档同步）

## Impact

**仅文档变更**
- `packages/bundlekit-docs/docs/index.md`
- `packages/bundlekit-docs/docs/guide.md`
- `packages/bundlekit-docs/docs/guide/cli.md`
- `packages/bundlekit-docs/docs/guide/config.md`
- `packages/bundlekit-docs/docs/guide/bundlers.md`
- `packages/bundlekit-docs/docs/guide/architecture.md`
- 新增 `packages/bundlekit-docs/docs/guide/ssr.md`
- `README.md`

**依赖前置**
- 必须在 change 1（refactor-bundler-deps）落地后才能写"bundler 缺失时 prompt"的描述
- 必须在 change 2（add-config-escape-hatch）落地后才能写 tools 用例
- 必须在 change 3（add-ssr-support）落地后才能写 ssr.md
- 必须在 change 4（improve-cli-ux）落地后才能写 ink 截图

可在前 4 个 change 部分落地时**渐进更新**对应章节。

**风险**
- 文档与代码同步问题：每次发版 release notes 必须同时引用本文档版本
- 用户老书签可能指向被删除的章节 — 保留旧 anchor 用 redirect / inline note
- 多语言版本（如有）需同步；当前仅中文文档，单一翻译版
