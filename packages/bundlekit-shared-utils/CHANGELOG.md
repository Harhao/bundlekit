# @bundlekit/shared-utils

## 0.0.9

### Patch Changes

- 8e12ab8: 修复项目初始化异常和启动开发环境异常

## 0.0.8

### Patch Changes

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

## 0.0.7

### Patch Changes

- a031ba5: feat: 新增 Parcel 2 / esbuild 打包器适配器，修复多项工程问题

  **@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

  **@bundlekit/bundler-esbuild**（新包）：基于 esbuild Go 实现，极速编译。支持 TypeScript/JSX/TSX/CSS/CSS Modules 原生处理、watch + DevServer、Library 模式、Code splitting（ESM）及 dev SSR middleware（`outExtension: {".js": ".cjs"}` + onEnd plugin 动态获取产物路径）。

  **@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"` / `"esbuild"`；`BUNDLER_PACKAGE_MAP` 对应新增两条映射；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 及 `detectAvailablePMs` 的 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式版本不匹配时拦截检测导致 pnpm 被误报未安装；`detectPackageManagerFromLockFile()` 新增从当前目录向上遍历查找锁文件，正确识别 pnpm workspace。

  **@bundlekit/service**：`loadBundlerPlugin` 改为三级解析策略（自然解析 → context 目录解析 → 动态 `import()` 降级），修复 pnpm 安装的 peerDependencies 无法被找到的问题。

  **@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel / esbuild；`detectAvailablePMs` 补充 `result.error` 检查；CLI rollup external 加入两个新 bundler 包。

  **@bundlekit/docs-agent**：修复 wrangler.toml 缺少 `account_id` 导致的 Cloudflare 鉴权错误；简化 CI/CD deploy workflow，移除独立 wrangler.toml。

## 0.0.6

### Patch Changes

- a19cb50: fix: 修复 loadBundlerPlugin 模块解析失败及 pnpm 工作区包管理器误识别问题

  **@bundlekit/service**：`loadBundlerPlugin` 原来通过 `require.resolve(name, { paths: [context/node_modules, ...] })` 查找打包工具插件，该 `paths` 参数会完全覆盖默认解析路径，导致 pnpm 安装在 `bundlekit-service/node_modules/` 里的 peerDependencies 永远无法被找到。修复后改为三级解析策略：① 自然解析（从 service 自身目录出发，优先命中 peerDependencies）→ ② 从项目 context 目录解析（兼容用户项目自行安装的场景）→ ③ 动态 `import()` 降级。

  **@bundlekit/shared-utils**：`PackageManager` 构造函数仅在 `context` 目录本身查找锁文件，pnpm monorepo 中各子包目录没有独立锁文件，导致检测失败后回退到 `hasYarnCommand()` 全局判断，在安装了 yarn 的机器上误用 `yarn add` 代替 `pnpm add`。修复后新增 `detectPackageManagerFromLockFile()` 方法，从当前目录向上遍历查找 `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`，正确识别 pnpm workspace。

## 0.0.5

### Patch Changes

- 09b8001: fix: 修复 pnpm 安装失败和版本号问题

  - 修复 pnpm `--reporter silent` 导致安装成功但返回 exit code 1 的问题
  - 模板版本号从 `"*"` 改为 `"workspace:^"`，生成时读取真实版本号
  - 新增 `readPackageVersion` 从 npm registry 读取最新版本号

## 0.0.4

### Patch Changes

- b8f4151: Fix package manager detection bugs:
  - Fix LRU cache key conflict causing wrong package manager to be detected
  - Fix async methods being called synchronously in constructor
  - Fix execa not checking exit code on failure
  - Fix pnpm add command using 'install' instead of 'add'
  - Remove incompatible --shamefully-hoist flag

## 0.0.3

### Patch Changes

- 81752e3: bump all packages to 0.0.3

## 0.0.2

### Patch Changes

- fix: bump version for npm publish
