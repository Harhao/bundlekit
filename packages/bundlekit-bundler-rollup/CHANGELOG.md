# @bundlekit/bundler-rollup

## 0.0.14

### Patch Changes

- 0a1b175: 修改 rollup pacth 版本

## 0.0.13

### Patch Changes

- 5303478: 修复 test 异常

## 0.0.12

### Patch Changes

- 8e12ab8: 修复项目初始化异常和启动开发环境异常
- Updated dependencies [8e12ab8]
  - @bundlekit/shared-utils@0.0.9

## 0.0.11

### Patch Changes

- fe2c801: 修复所有的 bundler 打包问题

## 0.0.10

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

- Updated dependencies [0ef5a9b]
  - @bundlekit/shared-utils@0.0.8

## 0.0.9

### Patch Changes

- Updated dependencies [a031ba5]
  - @bundlekit/shared-utils@0.0.7

## 0.0.8

### Patch Changes

- Updated dependencies [a19cb50]
  - @bundlekit/shared-utils@0.0.6

## 0.0.7

### Patch Changes

- Updated dependencies [09b8001]
  - @bundlekit/shared-utils@0.0.5

## 0.0.6

### Patch Changes

- d6a3baf: Fix tslib dependency in rollup bundler and update template versions

  - Move tslib from devDependencies to dependencies in @bundlekit/bundler-rollup to fix build error
  - Update template package versions from workspace:^ to \* for automatic latest version installation

## 0.0.5

### Patch Changes

- 9f2f088:
- 3020202: 修复 bundler-rollup 启动访问是空白
- Updated dependencies [b8f4151]
  - @bundlekit/shared-utils@0.0.4

## 0.0.4

### Patch Changes

- 9f2f088:

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
