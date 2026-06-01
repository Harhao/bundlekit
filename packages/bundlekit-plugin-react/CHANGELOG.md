# @bundlekit/plugin-react

## 0.0.13

### Patch Changes

- Updated dependencies [71acfd9]
- Updated dependencies [c00d434]
  - @bundlekit/shared-utils@0.0.10

## 0.0.12

### Patch Changes

- Updated dependencies [8e12ab8]
  - @bundlekit/shared-utils@0.0.9

## 0.0.11

### Patch Changes

- 6ce8afa: 修复 `@bundlekit/plugin-react@0.0.10` 与 `@bundlekit/plugin-vue@0.0.10` 误删 `template-react-ts/` 和 `template-vue3-ts/` 模板目录，导致 `npx @bundlekit/cli@latest create <name>` 选择 `react-ts` / `vue3-ts` 时报 `模板 "xxx" 未找到` 的问题。本次发布把两个 TS 模板目录补回包内。

## 0.0.10

### Patch Changes

- 0e06ecf: 修复项目的 lib 模式问题

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

- 0ef5a9b: fix(ssr): 修复 SSR 项目「页面渲染但点击事件不绑定」的问题，7 个 bundler × dev/build 全场景补齐 hydration

  原因：SSR 模式下生成的 HTML 缺少加载客户端 bundle 的 `<script>` 标签 →
  浏览器只拿到静态 HTML → 没有 client JS 执行 → React/Vue 没有 hydrate →
  事件 listener 不绑。

  ### 修复矩阵

  |          | Dev SSR                                                       | Build SSR                                  |
  | -------- | ------------------------------------------------------------- | ------------------------------------------ |
  | vite     | pages 触发 vite-plugin-html SPA 模式注入 entry                | vite-plugin-html 写 dist/index.html        |
  | webpack  | adapter `getTemplate` 手工注入 + 防重复守卫                   | HtmlWebpackPlugin 写 dist/index.html       |
  | rspack   | 同上                                                          | HtmlRspackPlugin 写 dist/index.html        |
  | rollup   | 新增 client watcher + static MW + dist/index.html 作 SSR 模板 | adapter `writeHtmlFile` 写 dist/index.html |
  | rolldown | 同上                                                          | 同上                                       |
  | esbuild  | 同上                                                          | 同上                                       |
  | parcel   | 同上                                                          | 同上                                       |

  ### 各包改动

  - **@bundlekit/plugin-react / plugin-vue（模板）**：SSR 模式也保留 `pages`，让 client pass 走 bundler 原生 HTML 流水线（保持 split chunks 顺序 / hashing 正确）；prod `ssr.template` 改为指向编译产物 `dist/index.html`，runtime 直接用它替换 `<!--ssr-outlet-->`。
  - **@bundlekit/shared-utils**：新增 `buildSSRHTMLTemplate`（递归扫描 client outDir，把 _.js / _.css 注入到源模板，handle vite 的 `assets/js/` 嵌套产物）；新增 `createStaticFileMiddleware`（dev SSR 静态资源服务，HTML fall-through 给 SSR handler）。
  - **@bundlekit/service**：SSR build 双 pass 间加兜底 HTML 注入器——若 client pass 没产 `dist/index.html`（用户删了 pages 或 bundler 异常），用 `buildSSRHTMLTemplate` 写一份。
  - **@bundlekit/bundler-rolldown / rollup / esbuild / parcel**：`createSSRMiddleware` 重写，从只跑 server compiler 改为 client + server 双 watcher，链上挂 `createStaticFileMiddleware` + SSR handler；handler 的 `getTemplate` 优先用 client 编译出的 `dist/index.html`（带 `<script>`），缺失才回退源模板。
  - **@bundlekit/bundler-webpack / rspack**：`getTemplate` 加防重复注入守卫——模板已含 `<script src=...>` 时直接返回，避免用户把 `ssr.template` 改到 prod `dist/index.html` 时双挂载。
  - **@bundlekit/bundler-rspack**：顺带修一个独立 bug——`prodBuild` 的 `compiler.run(callback)` 没包 Promise 就 return，Service 的 SSR 双 pass 会变成「fire-and-forget」导致兜底注入器读到空 dist；现在包成 `await new Promise(...)` 且加上 `stats.hasErrors()` reject。

- Updated dependencies [0ef5a9b]
  - @bundlekit/shared-utils@0.0.8

## 0.0.8

### Patch Changes

- Updated dependencies [a031ba5]
  - @bundlekit/shared-utils@0.0.7

## 0.0.7

### Patch Changes

- Updated dependencies [a19cb50]
  - @bundlekit/shared-utils@0.0.6

## 0.0.6

### Patch Changes

- 09b8001: fix: 修复 pnpm 安装失败和版本号问题

  - 修复 pnpm `--reporter silent` 导致安装成功但返回 exit code 1 的问题
  - 模板版本号从 `"*"` 改为 `"workspace:^"`，生成时读取真实版本号
  - 新增 `readPackageVersion` 从 npm registry 读取最新版本号

- Updated dependencies [09b8001]
  - @bundlekit/shared-utils@0.0.5

## 0.0.5

### Patch Changes

- d6a3baf: Fix tslib dependency in rollup bundler and update template versions

  - Move tslib from devDependencies to dependencies in @bundlekit/bundler-rollup to fix build error
  - Update template package versions from workspace:^ to \* for automatic latest version installation

## 0.0.4

### Patch Changes

- Updated dependencies [b8f4151]
  - @bundlekit/shared-utils@0.0.4

## 0.0.3

### Patch Changes

- 81752e3: bump all packages to 0.0.3
- Updated dependencies [81752e3]
  - @bundlekit/shared-utils@0.0.3

## 0.0.2

### Patch Changes

- fix: bump version for npm publish
- Updated dependencies
  - @bundlekit/shared-utils@0.0.2
