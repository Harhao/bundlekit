---
"@bundlekit/bundler-parcel": patch
"@bundlekit/service": patch
"@bundlekit/cli": patch
"@bundlekit/docs-agent": patch
---

汇总修复：Parcel HTML 生成、Service bundler 加载、CLI 面板刷帧、文档更新

### @bundlekit/bundler-parcel — fix: 修复 dev/build 不生成 HTML 导致页面空白的问题

- 新增 `writeHtmlFile()` 函数，构建完成后扫描 outDir 中的 JS/CSS 产物并写入 `index.html`
- 若配置了 `pages[0].template` 则读取模板注入 script/link 标签，否则自动生成最小 HTML（含 `<div id="root">`）
- `devBuild()`：每次 Parcel watch 构建成功后调用，再启动/reload DevServer，确保首次访问即有 HTML
- `prodBuild()`：`bundler.run()` 完成后调用，保证生产产物包含 `index.html`

### @bundlekit/service — fix: 修复安装 bundler 插件后仍无法加载的问题

- `loadBundlerPlugin` 改用用户项目目录（`this.context`）作为 `createRequire` 基准路径
  - 原来以 `import.meta.url`（service 包自身位置）为基准，全局安装时无法找到用户项目中新安装的包
- ESM 兜底改用 `pathToFileURL(resolvedPath).href` 替换 bare specifier
  - 原来 `import(packageName)` 仍从 service 文件位置解析，与安装路径无关
- 新增实际错误信息打印，方便排查加载失败原因

### @bundlekit/cli — fix: 修复创建项目面板步骤文案显示节奏不平滑

`CreateApp.tsx` 创建项目流程中，React/Ink setState 合批 + 中间同步 I/O 阻塞事件循环，导致多个步骤的 `✔` 状态批量跳出，初始 5 个 pending 标签也看不到独立首帧。

- 新增 `yieldFrame()`（`setTimeout(0)` 跳宏任务），让 Ink 有机会把帧 paint 到终端
- `setTasks(initialTasks)` 之后先 yield 一次，让"全 pending"初始帧可见
- 每个步骤 `running`/`done` 状态切换后各 yield 一次，避免合批

### @bundlekit/docs-agent — docs: 更新文档以反映 Parcel 2 与 esbuild 适配器的加入，七种打包器全覆盖

- `docs/index.md`：hero description 与 SSR 特性说明从"五种"更新为"七种"
- `docs/guide.md`：快速开始介绍从五种更新为七种，bundler 选择列表加入 parcel/esbuild，SSR 章节同步更新
- `docs/guide/bundlers.md`：打包器列表加入 Parcel 2 与 esbuild 行；各打包器特性新增 Parcel/esbuild 章节；配置字段映射表扩展至七列；SSR 支持矩阵加入 parcel/esbuild 行
- `docs/guide/ssr.md`：bundler 数量更新为七个；HMR 支持矩阵加入 parcel/esbuild 行及说明
- `packages/bundlekit-docs/README.md`：更新标题与简介（`bundlekit-cli-docs` 在 changeset ignore 列表中，本文不在 frontmatter 显式声明）
- `packages/bundlekit-docs-agent/README.md`：intro 注明覆盖七种打包器
