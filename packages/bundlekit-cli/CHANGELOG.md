# @bundlekit/cli

## 0.0.9

### Patch Changes

- fb94642: feat(library): 类库 / SDK 打包模式全 7 个 bundler 完整支持

  之前 `library: true` / `libraryName: "MyLib"` 字段只在 rollup / rolldown / parcel 上有效，且 esbuild 的 UMD 是降级到 iife 的（没全局变量名）。这一轮把支持矩阵补齐：

  ### 各 adapter 改动

  - **@bundlekit/bundler-webpack / rspack**：之前两家不读 `library` 字段，client pass 始终设 `output.library`。现在：
    - `library: true` 时跳过 `HtmlWebpackPlugin` / `HtmlRspackPlugin`（不产 SPA shell HTML）
    - `libraryName` 填到 `output.library.name`，UMD 自动加 `umdNamedDefine + globalObject`
    - format 标准化映射：`esm → 'module'`（开 `experiments.outputModule`）/ `commonjs → 'commonjs2'` / `umd / iife / amd` 透传
  - **@bundlekit/bundler-vite**：之前 vite adapter 完全不读 `library` 字段。现在 `library: true` 走 vite 原生 `build.lib` 模式：
    - `formats` 数组转 vite 的 `lib.formats`，UMD/IIFE 自动塞 `lib.name = libraryName`
    - 跳过 `vite-plugin-html`，文件名按 `<entry>.<format-ext>` 命名
    - 默认把 `package.json` 的 `dependencies + peerDependencies` 自动 externalize（react/vue/react-dom 自带 globals 映射）
  - **@bundlekit/bundler-esbuild**：UMD 不再降级 iife，而是 `format: iife + globalName + banner/footer` 包真 UMD wrapper（CJS / AMD / Browser 三种宿主都能跑）

  ### CLI 改动

  - `bc create <name> --lib --library-name <name>`：新增 `--lib` 与 `--library-name` flag，TTY / non-TTY 两条路径都接上
  - 默认 `libraryName` 取项目名转 PascalCase（`my-lib` → `MyLib`），用户可显式覆盖
  - `--lib` 自动跳过 SSR prompt（语义不兼容）

  ### 模板改动

  - `@bundlekit/plugin-react / plugin-vue` 各自加：
    - `src/lib-entry.{tsx|jsx|ts|js}.ejs`：generator 在 library 模式下重命名为 `src/index.<ext>`，re-export `App` + 默认导出 `<%= libraryName %>`
    - `.bundlekitrc.{ts|js}.ejs` 加 `<% if (library) %>` 顶层分支：多格式 `["esm","commonjs","umd"]`、`library: true` + `libraryName`、`externals: ["react","react-dom"]` / `["vue"]`、不含 `pages`、不含 `devServer`
    - Library 模式下 generator 跳过 `public/`、`index.{tsx|jsx}`、`main.{ts|js}`、entry-server / entry-client（这些都是应用 mount 入口，SDK 用不到）

  ### 测试覆盖

  新增 14 个 build 集成测试（7 bundler × 2 模式）：

  - `build/<bundler>-lib.test.ts`：基础 CJS lib build，require 出 `add(2,3)===5`
  - `build/<bundler>-lib-umd.test.ts`：UMD build，验证产物含 `libraryName`，用 vm 在伪 browser 环境 eval 后 `globalThis.MyLib.add(2,3)===5`
    - parcel 此项 skip：Parcel 原生只支持 commonjs/global outputFormat，没 UMD wrapper

  新增 3 个 CLI `--lib` 集成测试：验证 react-ts / vue3-ts library 模式下文件结构 + `.bundlekitrc.ts` 内容 + `--library-name` 覆盖默认值。

  ### 支持矩阵

  | 能力                           | rollup | rolldown | webpack       | rspack        | vite   | esbuild       | parcel      |
  | ------------------------------ | ------ | -------- | ------------- | ------------- | ------ | ------------- | ----------- |
  | `library` / `libraryName` 字段 | ✅     | ✅       | **✅**        | **✅**        | **✅** | **✅**        | ✅          |
  | 真 UMD（含全局名）             | ✅     | ✅       | **✅**        | **✅**        | **✅** | **✅**        | ❌          |
  | 多格式同时输出                 | ✅     | ✅       | 取 formats[0] | 取 formats[0] | **✅** | 取 formats[0] | 仅 commonjs |
  | Library 跳过 HTML 入口         | ✅     | ✅       | **✅**        | **✅**        | **✅** | ✅            | ✅          |
  | 自动 external peerDeps         | 透传   | 透传     | 透传          | 透传          | **✅** | 透传          | 透传        |

  加粗 = 本次新增能力。

- 1308e66: feat(plugin-node): 新增 @bundlekit/plugin-node，支持纯 TypeScript / Node.js 项目模板

  新增 `@bundlekit/plugin-node` 插件，为 Node.js 工具库、CLI、后端服务等场景提供纯 TypeScript 项目脚手架。

  ### 新增内容

  **`packages/bundlekit-plugin-node`**（全新包）：

  - `index.ts`：插件主入口，给所有 env 打 `framework='node'` 标记，并移除 devServer 配置（Node 库不需要本地开发服务）
  - `generator/index.ts`：CLI create 流程回调，调用 `addPluginToConfig` 自动写入 `.bundlekitrc.ts`
  - `templates/template-node-ts/`：模板文件集合
    - `.bundlekitrc.ts.ejs`：按 `library` 模式分支生成配置：
      - 普通模式：`target: "node"`, `formats: ["esm", "commonjs"]`，双格式输出，无 HTML 入口
      - Library 模式：额外加 `library: true` + `libraryName`，适合发布到 npm 的 SDK
    - `src/index.ts.ejs`：应用入口（含 `greet` / `add` 示例 + `isMain` 判断，可直接 `node` 运行）
    - `src/lib-entry.ts.ejs`：库入口（`--lib` 模式由 generator 重命名为 `src/index.ts`，re-export `utils.ts` + 默认导出命名空间）
    - `src/utils.ts`：基础工具函数（`greet` / `add`，作为 SDK 函数示例）
    - `tsconfig.json`：Node 友好的 TS 配置（`target: ES2020`，`module: NodeNext`，开 `declaration + declarationMap`）
    - `package.json.ejs`：含 `"type": "module"` + `exports` 字段（`import`/`require`/`default` 三条路径）+ `typecheck` script

  **CLI 改动**：

  - `index.tsx`：TEMPLATES 新增 `node-ts`（显示名：Node.js / 纯 TypeScript（无框架））
  - `lib/commands/create/actions.ts`：
    - `normalizeTemplate` 加 `node` / `node-ts` 别名
    - `resolvePluginPkgName` 加 `node-*` → `@bundlekit/plugin-node` 分支
    - 错误提示加入 `node-ts`
  - `lib/utils/generatorRunner.ts`：重构 generator 查找逻辑，从「`require.resolve` subpath exports」改为「先 resolve `package.json` 定位包根目录，再拼接 `generator/index.ts|js|cjs|mjs`，最后用 jiti 加载」—— 彻底解决 `.ts` 源文件无法被原生 `import()` 加载的问题，同时兼容 monorepo 和已发布场景
  - `package.json`：`dependencies` 增加 `@bundlekit/plugin-node: workspace:*`

  **plugin-react / plugin-vue package.json**：加 `exports` 字段（`"./generator": "./generator/index.ts"`），让 `require.resolve` 能正常解析 generator 子路径（为 generatorRunner 重构预留）

  ### 使用方式

  ```bash
  # 普通 Node.js / 纯 TS 项目
  bc create my-ts-app -t node-ts -b rollup

  # SDK / 库项目（双格式 esm + cjs，无 HTML）
  bc create my-ts-sdk -t node-ts -b rollup --lib --library-name MySDK
  ```

  ### 测试覆盖

  新增 8 个集成测试：

  - `__tests__/integration/cli/cli-plugin-node.test.ts`：7 个 CLI create 场景用例（普通模式 / library 模式 / 文件结构 / `.bundlekitrc.ts` 内容 / `package.json` 结构）
  - `__tests__/integration/build/node-lib.test.ts`：1 个 build 测试（rollup 打 node library，require 出 `add(2,3)===5`）

  59 单元 + 45 集成全部通过（1 parcel UMD skip 为已知缺口）。

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

- Updated dependencies [fb94642]
- Updated dependencies [1308e66]
- Updated dependencies [0ef5a9b]
  - @bundlekit/plugin-react@0.0.9
  - @bundlekit/plugin-vue@0.0.9
  - @bundlekit/shared-utils@0.0.8
  - @bundlekit/plugin-node@0.0.2

## 0.0.8

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
  - @bundlekit/plugin-react@0.0.8
  - @bundlekit/plugin-vue@0.0.8

## 0.0.7

### Patch Changes

- Updated dependencies [a19cb50]
  - @bundlekit/shared-utils@0.0.6
  - @bundlekit/plugin-react@0.0.7
  - @bundlekit/plugin-vue@0.0.7

## 0.0.6

### Patch Changes

- 09b8001: fix: 修复 pnpm 安装失败和版本号问题

  - 修复 pnpm `--reporter silent` 导致安装成功但返回 exit code 1 的问题
  - 模板版本号从 `"*"` 改为 `"workspace:^"`，生成时读取真实版本号
  - 新增 `readPackageVersion` 从 npm registry 读取最新版本号

- Updated dependencies [09b8001]
  - @bundlekit/shared-utils@0.0.5
  - @bundlekit/plugin-react@0.0.6
  - @bundlekit/plugin-vue@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [d6a3baf]
  - @bundlekit/plugin-react@0.0.5
  - @bundlekit/plugin-vue@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [b8f4151]
  - @bundlekit/shared-utils@0.0.4
  - @bundlekit/plugin-react@0.0.4
  - @bundlekit/plugin-vue@0.0.4

## 0.0.3

### Patch Changes

- 81752e3: bump all packages to 0.0.3
- Updated dependencies [81752e3]
  - @bundlekit/plugin-react@0.0.3
  - @bundlekit/shared-utils@0.0.3
  - @bundlekit/plugin-vue@0.0.3

## 0.0.2

### Patch Changes

- fix: bump version for npm publish
- Updated dependencies
  - @bundlekit/plugin-react@0.0.2
  - @bundlekit/plugin-vue@0.0.2
  - @bundlekit/shared-utils@0.0.2
