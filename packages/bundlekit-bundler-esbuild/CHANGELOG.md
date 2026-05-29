# @bundlekit/bundler-esbuild

## 0.0.7

### Patch Changes

- d544872: 修复安装依赖寻找路径的问题

## 0.0.6

### Patch Changes

- 27845b4: 修复切换 bundler 会报安装依赖失败问题

## 0.0.5

### Patch Changes

- 8e12ab8: 修复项目初始化异常和启动开发环境异常
- Updated dependencies [8e12ab8]
  - @bundlekit/shared-utils@0.0.9

## 0.0.4

### Patch Changes

- fe2c801: 修复所有的 bundler 打包问题

## 0.0.3

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

## 0.0.2

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
