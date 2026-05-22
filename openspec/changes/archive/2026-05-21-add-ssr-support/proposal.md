## Why

当前 `bundle-bundlekit` 只能产出客户端 bundle（CSR）。`IEnvBuildConfig.target` 字段虽然有 `'web' | 'node'` 选项，但没有 SSR 流水线 — 即没有"客户端 bundle + 服务端 bundle"的双产物概念，没有 SSR 入口约定，也没有 dev SSR middleware。

用户需要在所有 5 个 bundler（webpack / vite / rspack / rollup / rolldown）上都能跑 SSR：
- **build**：同时产出 client（注入 HTML）+ server（Node 可执行模块）
- **serve**：开发态启动 dev server，请求被劫持后用 server bundle 渲染 HTML 注水

本 change 引入完整的 SSR 能力。

## What Changes

- 在 `IEnvBuildConfig` 上新增 `ssr` 字段：
  ```ts
  ssr?: {
    entry: string;                     // src/entry-server.tsx
    output: { dir: string; filename: string; formats: 'commonjs' | 'esm' };
    externals?: 'auto' | (string | RegExp)[];   // 'auto' = 把 node_modules 全部 externalize
    template?: string;                 // dev/prod HTML 模板，用于占位替换 <!--ssr-outlet-->
    clientEntry?: string;              // 默认沿用 envConfig.entry；可显式分离
    placeholder?: string;              // 默认 "<!--ssr-outlet-->"
  }
  ```
- `IBuildToolAdapter` 接口新增可选方法 `createSSRMiddleware?(buildConfig, ctx): Promise<RequestHandler>`，由各 bundler 适配器按自身能力实现 dev SSR。
- `Service.startBuilder()` 在检测到 `ssr` 字段时切换到 SSR 流水线：
  - **build**：串行跑两次 — `pass: 'client'` → `pass: 'server'`，server pass 把 `target` 强制设为 `'node'`、`output` 切到 ssr.output、`externals` 按 ssr.externals 计算，hook 中 `ctx.env = 'server'`。
  - **serve**：默认仍只跑 client dev server；用户在 ssr 字段中加 `dev: true` 开关时启动 SSR dev middleware（由各 adapter 提供）。
- 约定 SSR 入口：`src/entry-client.tsx`（client） + `src/entry-server.tsx`（server export render(url)）。
- 5 个 bundler 适配器各自实现 SSR：
  - **webpack**：`target: 'node'` + `libraryTarget: 'commonjs2'` + `webpack-node-externals` + `webpack-dev-middleware` + `webpack-hot-middleware`（dev SSR）
  - **vite**：原生支持，build 走 `ssr` option，dev 用 `ssrLoadModule` + `transformIndexHtml`
  - **rspack**：与 webpack 镜像；dev 用 `@rspack/dev-server` 的 middleware mode
  - **rollup**：`output.format: 'cjs'/'esm'` + watch；dev 无 HMR，靠进程重启
  - **rolldown**：与 rollup 类似
- cli 模板新增 `entry-client.tsx` / `entry-server.tsx` 与 `index.html` 中 `<!--ssr-outlet-->` 占位，`react-ts/js` 与 `vue3-ts/js` 都要补。
- 新增 `tools.<bundler>` 钩子调用时 `ctx.env` 区分 `'client' | 'server'`（与 change 2 协同）。

## Capabilities

### New Capabilities
- `ssr-build`: 描述 SSR 双产物的 build 流水线、配置字段、外部依赖处理、错误语义。
- `ssr-dev-middleware`: 描述各 bundler 在 dev 模式下的 SSR middleware 行为、HMR 支持矩阵、降级语义。

### Modified Capabilities
- `service-core`: `startBuilder` 增加 SSR 双 pass 分支
- `webpack-adapter`: 实现 SSR build pass + dev middleware
- `vite-adapter`: 实现 SSR build pass + dev middleware
- `rspack-adapter`: 实现 SSR build pass + dev middleware
- `rollup-adapter`: 实现 SSR build pass（rolldown 暂归并）

## Impact

**新增依赖**
- `webpack-node-externals`（webpack/rspack 共用）
- `webpack-dev-middleware`、`webpack-hot-middleware`（webpack 用）
- `@rspack/dev-server` 的 middleware mode 已自带（仅版本要求）

**代码变更**（粗略文件级）
- `packages/bundlekit-shared-utils/lib/types/cli-service/config.ts`：`ssr` 字段
- `packages/bundlekit-shared-utils/lib/types/cli-service/adapter.ts`：`createSSRMiddleware?`
- `packages/bundlekit-service/lib/Service.ts`：`startBuilder` SSR 分支 + dev SSR HTTP server orchestration
- `packages/bundlekit-bundler-{webpack,vite,rspack,rollup,rolldown}/src/index.ts`：实现 SSR transform & middleware
- `packages/bundlekit-plugin-{react,vue}/templates/`：新增 entry-client / entry-server 与 ssr-outlet HTML

**API**
- `IEnvBuildConfig.ssr` 新公共字段（向后兼容，可选）
- `IBuildToolAdapter.createSSRMiddleware` 新可选方法

**文档**
- `bundlers.md`：HMR 支持矩阵表格
- 新增 `docs/guide/ssr.md` 完整指南

**风险**
- 工作量大（5 个 bundler × 2 个模式），分阶段落地可能需要拆 milestone。
- 多页面（pages）+ SSR 不并存（第一版只 SPA SSR）。
- rollup/rolldown 的 dev SSR 体感差（无 HMR），文档需明确说明。
- 用户已存在 `target: 'node'` 用法（独立的 node 库构建）与 SSR pass 的语义需要清晰区分。
