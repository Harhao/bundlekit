# @bundlekit/bundler-parcel

## 0.0.4

### Patch Changes

- 8196668: 汇总修复：Parcel HTML 生成、Service bundler 加载、CLI 面板刷帧、文档更新

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

## 0.0.3

### Patch Changes

- a031ba5: feat: 新增 Parcel 2 / esbuild 打包器适配器，修复多项工程问题

  **@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

  **@bundlekit/bundler-esbuild**（新包）：基于 esbuild Go 实现，极速编译。支持 TypeScript/JSX/TSX/CSS/CSS Modules 原生处理、watch + DevServer、Library 模式、Code splitting（ESM）及 dev SSR middleware（`outExtension: {".js": ".cjs"}` + onEnd plugin 动态获取产物路径）。

  **@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"` / `"esbuild"`；`BUNDLER_PACKAGE_MAP` 对应新增两条映射；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 及 `detectAvailablePMs` 的 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式版本不匹配时拦截检测导致 pnpm 被误报未安装；`detectPackageManagerFromLockFile()` 新增从当前目录向上遍历查找锁文件，正确识别 pnpm workspace。

  **@bundlekit/service**：`loadBundlerPlugin` 改为三级解析策略（自然解析 → context 目录解析 → 动态 `import()` 降级），修复 pnpm 安装的 peerDependencies 无法被找到的问题。

  **@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel / esbuild；`detectAvailablePMs` 补充 `result.error` 检查；CLI rollup external 加入两个新 bundler 包。

  **@bundlekit/docs-agent**：修复 wrangler.toml 缺少 `account_id` 导致的 Cloudflare 鉴权错误；简化 CI/CD deploy workflow，移除独立 wrangler.toml。

- Updated dependencies [a031ba5]
  - @bundlekit/shared-utils@0.0.7

## 0.0.2

### Patch Changes

- adbfb8f: feat: 新增 Parcel 2 打包器适配器，修复多项工程问题

  **@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

  **@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"`；`BUNDLER_PACKAGE_MAP` 新增 `parcel → @bundlekit/bundler-parcel`；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 及 `detectAvailablePMs` 的 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式版本不匹配时拦截检测导致 pnpm 被误报未安装；`detectPackageManagerFromLockFile()` 新增从当前目录向上遍历查找锁文件，正确识别 pnpm workspace。

  **@bundlekit/service**：`loadBundlerPlugin` 改为三级解析策略（自然解析 → context 目录解析 → 动态 `import()` 降级），修复 pnpm 安装的 peerDependencies 无法被找到的问题。

  **@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel；`detectAvailablePMs` 补充 `result.error` 检查；CLI rollup external 加入 `@bundlekit/bundler-parcel`。

  **@bundlekit/docs-agent**：修复 wrangler.toml 缺少 `account_id` 导致的 Cloudflare 鉴权错误；简化 CI/CD deploy workflow，改用 wrangler-action 命令行参数方式，移除独立 wrangler.toml。

- Updated dependencies [adbfb8f]
  - @bundlekit/shared-utils@0.0.6
