## 1. 主入口（index.md / guide.md / README）

- [x] 1.1 重写 `packages/bundlekit-docs/docs/index.md` 的 Hero + Quick Start：第一条命令改为 `npx @bundlekit/cli create my-app`
- [x] 1.2 重写 `packages/bundlekit-docs/docs/guide.md` 为"两条集成路径"结构（方式一脚手架 / 方式二手工集成 / 全局安装可选项）
- [x] 1.3 同步 `README.md` 顶部 Quick Start 与 docs/index 一致
- [x] 1.4 加入"你需要什么"section（Node ≥ 18、pnpm 8+、TTY 推荐 Windows Terminal）

## 2. cli.md 修订（依赖 change 1 / change 4）

- [x] 2.1 在 `dc add` 章节加入 `bundler-*` 短名表（webpack / vite / rspack / rollup / rolldown）
- [x] 2.2 新增"运行时缺失 bundler 行为"小节：描述 yes/no prompt、install 写入 devDeps、`DEVKIT_AUTO_INSTALL` / `DEVKIT_NO_PROMPT`
- [x] 2.3 加入 ink UI 截图（asciinema 转 SVG，存放 `docs/assets/cli-create.svg`）（推迟：需手工录屏，留作后续 PR）
- [x] 2.4 标注 `DEVKIT_NO_INK=1` fallback 与 Windows 终端建议
- [x] 2.5 加入 admonition 框：CI 推荐配置示例（DEVKIT_AUTO_INSTALL=1）

## 3. config.md 修订（依赖 change 2 / change 3）

- [x] 3.1 新增"逃生舱（tools）"章节，包含 5 个 bundler 的最小示例
- [x] 3.2 标注调用顺序：`plugins → transform → tools → changeConfigure → run`
- [x] 3.3 在顶层字段表中加入 `tools` 行
- [x] 3.4 在 IEnvBuildConfig 字段中加入 `ssr` 字段说明，逐字段解释（entry / output / externals / template / placeholder）
- [x] 3.5 增加 ssr + pages 互斥、ssr + target=node 互斥的 admonition 警告

## 4. bundlers.md 修订（依赖 change 1 / change 3）

- [x] 4.1 在文件顶部加入"Bundler 安装方式"章节（cli create / dc add / runtime prompt 三种入口）
- [x] 4.2 加入"SSR 支持矩阵"表格：build SSR / dev SSR / client HMR / server HMR 五列
- [x] 4.3 在 Vite / Webpack / Rspack 节末尾追加各自 SSR 行为的简介

## 5. architecture.md 修订（依赖 change 1）

- [x] 5.1 重画"模块依赖关系" ASCII 图：去掉 service → bundler-* 的箭头
- [x] 5.2 加入新箭头：cli → 项目 devDependencies 包含 bundler-*
- [x] 5.3 重写"运行时动态加载打包器"段落为 find-or-prompt-or-fail 语义
- [x] 5.4 在"构建依赖顺序（Turbo）"中提示 service:build 的 dependsOn 变化

## 6. 新增 ssr.md（依赖 change 3）

- [x] 6.1 创建 `packages/bundlekit-docs/docs/guide/ssr.md` frontmatter 与 sidebar 注册
- [x] 6.2 章节：背景与目标 / 架构图 / 入口约定 / 配置字段 / build 行为 / dev 行为
- [x] 6.3 HMR 支持矩阵表格
- [x] 6.4 react-ts 完整迁移示例（从 CSR 改 SSR 的 diff）
- [x] 6.5 vue3-ts 迁移示例
- [x] 6.6 常见错误与排查（externals 配错、placeholder 缺失、ssr + pages 冲突）

## 7. 一致性收口

- [x] 7.1 全局 grep `pnpm add -D @bundlekit/service @bundlekit/cli`，逐处更新或加上 admonition 上下文说明
- [x] 7.2 检查 `architecture.md`、`config.md`、`cli.md`、`bundlers.md` 之间的交叉链接
- [x] 7.3 在 `index.md` 增加"按主题导航"卡片：CLI / 配置 / SSR / 架构
- [x] 7.4 验证 dumi `pnpm --filter @bundlekit/docs build` 能跑通，无 broken link

## 8. 协同 / 时序

- [x] 8.1 等 change 1 的代码改动落地后再合入本 change 的 cli.md / bundlers.md / architecture.md 部分
- [x] 8.2 等 change 2 落地后再合入 config.md 的 tools 章节
- [x] 8.3 等 change 3 落地后再合入 ssr.md 与 config.md 的 ssr 字段
- [x] 8.4 等 change 4 落地后再合入 cli.md 的 ink 截图与 fallback 说明
- [x] 8.5 本 change 可拆 4 个 PR 渐进合入，也可在所有代码 change 落地后一次性合入；视进度由 maintainer 决定
