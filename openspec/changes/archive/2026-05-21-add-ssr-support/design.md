## Context

**当前能力**
- 5 个 bundler 都只产出 client bundle（`target: 'web'` 默认）
- `target: 'node'` 字段虽然存在，但只用于"非浏览器"目标（库构建场景），不是 SSR 双产物
- `Service.startBuilder` 单次调度一个 adapter 的 transform → run，没有 pass 概念

**业界对照**

| 工具 | SSR 入口约定 | dev SSR 实现 |
|---|---|---|
| Vite | `entry-server.ts` (export `render`) | `ssrLoadModule` + `transformIndexHtml` |
| Next.js | App Router 内部约定 | 自带 server framework |
| Nuxt | `~/server/render.ts` | Nitro |
| Rsbuild | `entry-server.ts` | webpack/rspack dev middleware |

我们仿 Rsbuild / Vite 思路：约定 `entry-client` + `entry-server` 双入口，build 双产物，dev 用 middleware 注入。

**约束**
- 不能引入对具体 framework（react / vue）的硬依赖；framework 渲染逻辑由用户在 `entry-server` 里写。
- 与 change 1 的 bundler 解耦不冲突 — SSR 只在用户已经安装的 bundler 内启用。
- 与 change 2 的 tools hook 协同：`ctx.env` 字段必须能区分 client/server pass。

## Goals / Non-Goals

**Goals**
- 5 个 bundler 全部支持 build SSR（双产物）
- vite / webpack / rspack 支持 dev SSR middleware（含 HMR）
- rollup / rolldown 支持 dev SSR middleware（无 HMR，仅 watch + 进程重启）
- 与 tools hook（change 2）协同：用户能用 `tools.webpack(config, { env: 'server' })` 改 server bundle
- 错误语义清晰：SSR 失败时 dev 渲染 stack overlay，build 直接 exit(1)

**Non-Goals**
- 不实现 framework-specific 渲染逻辑（用户自己写 `entry-server`）
- 不支持多页面 SSR（pages[] 与 ssr 互斥，第一版只支持 SPA SSR）
- 不实现流式 SSR / RSC
- 不实现 Edge runtime / Cloudflare Worker 输出
- 不支持 `target: 'node'` 单产物模式与 ssr 字段同时启用（明确互斥）

## Decisions

### D1：SSR 配置形态 — 子字段 vs 双 envConfig

**采用子字段 `ssr` 方案**：

```ts
config: {
  production: {
    target: 'web',                     // ← client 部分继承现有 envConfig
    entry: 'src/entry-client.tsx',
    output: { dir: 'dist/client', ... },
    ssr: {                             // ← 新增子字段
      entry: 'src/entry-server.tsx',
      output: { dir: 'dist/server', filename: 'server.cjs', formats: 'commonjs' },
      externals: 'auto',
      template: 'public/index.html',
      placeholder: '<!--ssr-outlet-->',
    }
  }
}
```

为什么不做"独立 server envConfig"？
- 双 envConfig 的字段重复严重（alias / publicPath / css / inject 这些 client server 共用）
- 子字段更接近 Vite/Rsbuild 的心智，迁移友好

### D2：dual-pass 调度位置

放在 `Service.startBuilder()`，而**不是**在 adapter 内做。

```
┌──────────────────────────────────────────────────────────────┐
│ Service.startBuilder()                                       │
│   if (envConfig.ssr) {                                       │
│     await runOnePass({ env: 'client', target: 'web' })       │
│     await runOnePass({ env: 'server', target: 'node',        │
│                       overrideOutput: ssr.output,            │
│                       externals: resolveSSRExternals(...) }) │
│   } else {                                                   │
│     await runOnePass({ env: 'client' })                      │
│   }                                                          │
└──────────────────────────────────────────────────────────────┘
```

`runOnePass` 内部仍走原本的 transform → tools → changeConfigure → run 流程，只是把 ctx.env 与 override 透传。

理由：
- adapter 接口稳定，每个 bundler 只需"知道当前是 client 还是 server"
- 复用 tools hook（ctx.env）做用户层精细化

### D3：dev SSR — 谁起 HTTP server？

```
┌────────────────────────────────────────────────────────────────┐
│  Option A：service 起 HTTP server，adapter 提供 middleware    │  ✅ 选用
│  Option B：adapter 起自身的 dev server，自己挂 SSR middleware │
└────────────────────────────────────────────────────────────────┘
```

**A** 让 service 拿到统一的 SSR HTTP framework（`http.createServer` + `connect`），adapter 实现 `createSSRMiddleware()` 返回 RequestHandler。这样：
- vite：`createSSRMiddleware` 内部 `createServer({ middlewareMode: true })`，拿到 vite middlewares + 自定义 SSR handler
- webpack：返回 `[devMiddleware, hotMiddleware, ssrHandler]` 三段中间件链
- rspack：同 webpack
- rollup/rolldown：返回 watcher + 自定义 ssrHandler（每次请求都 require 最新的 server bundle）

service 用 `connect` 把 middleware 串起来，绑定 `host:port`。

### D4：externals: 'auto' 的实现

各 bundler 都需要把项目的 `node_modules` externalize（不打入 server bundle）。

- webpack/rspack：`webpack-node-externals` 包
- vite：`build.rollupOptions.external` + 默认 vite 在 ssr build 时已经 external 所有 node 内置模块
- rollup/rolldown：手写 `external` 函数，凡是 `require.resolve(id)` 解析到 node_modules 路径就 external

shared-utils 中提供工具函数 `resolveSSRExternals(ssrConfig, projectRoot): string[] | RegExp[] | (id) => boolean`。

### D5：HTML 模板替换

约定 HTML 文件中包含 `<!--ssr-outlet-->`（默认占位符，可在 `ssr.placeholder` 改）。

- **build 模式**：client pass 的 `HtmlWebpackPlugin / vite-plugin-html / HtmlRspackPlugin` 仍负责生成基础 HTML；产出后由 service 复制到 `dist/client/index.html`，server bundle 中的 render() 在请求时读取这份 HTML，把 `<!--ssr-outlet-->` 替换成渲染结果。
- **dev 模式**：service 的 SSR handler 读取 `template` 配置项（默认 `public/index.html`），先让 vite/webpack 处理 HTML（注入 dev script），再调 `entry-server.render(url)` 替换 outlet。

### D6：HMR 支持矩阵

| Bundler | client HMR | server HMR | 说明 |
|---|---|---|---|
| vite | ✅ | ✅ | ssrLoadModule 自带模块失效 |
| webpack | ✅ | ⚠️ 进程级 | webpack-hot-middleware client OK；server 用 watch + 清 require cache |
| rspack | ✅ | ⚠️ 同 webpack | |
| rollup | ❌ | ❌ | watch + 进程重启 |
| rolldown | ❌ | ❌ | 同 rollup |

文档中以表格形式给出，避免用户误用。

### D7：SSR + 多页面（pages[]）冲突

第一版**严格互斥**：

```ts
if (envConfig.pages?.length && envConfig.ssr) {
  throw new Error('SSR 模式暂不支持 pages[] 多页面，请二选一');
}
```

理由：多页面 SSR 路由分发复杂度高，留作后续。

### D8：`target: 'node'` 与 `ssr` 互斥

- `target: 'node'` 是单产物 Node 库构建模式
- `ssr` 是"client 用 web target + server 用 node target"双产物模式
- 两者放一起语义不清；service 检测到同时启用时报错退出。

### D9：测试矩阵

最小测试集（每个 bundler 至少一组）：

| 用例 | 期望 |
|---|---|
| build SSR (react-ts) on each bundler | dist/client + dist/server 双产物，server.cjs 可 require 并 render |
| dev SSR (vite/webpack/rspack) | curl localhost:3000 拿到注水后的 HTML |
| dev SSR (rollup/rolldown) | 同上，但 HMR 不验证 |
| ssr.externals='auto' | dist/server/server.cjs 体积接近源码量级（不打 node_modules）|
| pages + ssr 报错 | service 启动即 exit(1) |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 工作量超大，单次 PR 难以 review | 拆成 5 个 milestone：核心 schema + service 流水线 → vite SSR → webpack/rspack SSR → rollup/rolldown SSR → 文档 + 模板 |
| webpack/rspack 的 dev middleware HMR 与 vite 行为差异，用户习惯不一致 | 文档明确"vite 推荐用于 SSR dev"，其他 bundler 列为可用 |
| externals='auto' 配错时 server bundle 把 react 也打了，导致渲染错误（双 react 实例） | 默认 externalize 所有 dependencies；提供 `bundleDependencies: string[]` 例外名单 |
| 用户已有 entry: 'src/index.tsx' 的项目升级时无 entry-server，需迁移 | docs/guide/ssr.md 提供迁移示例；模板默认带双入口（仅 ssr 模式启用时才渲染 entry-server.tsx） |
| 进程级 HMR 在并发请求下 require 缓存清理可能 race | 用 `import()` + `module._cache` 显式 invalidate；测试中加并发用例 |
| 旧版本 cli 模板未提供 entry-server，已有项目升级断裂 | cli 在 `dc add ssr` 提供 generator（可选方向）— 第一版仅文档指引，不做 generator |

## Migration Plan

1. **Phase 1：核心 schema + service 流水线**
   - shared-utils 加 ssr 字段类型
   - service.startBuilder 加 dual-pass 分支
   - Service 内部能跑通 client-only fallback（确保不破坏现有用户）

2. **Phase 2：vite SSR（最容易）**
   - 实现 createSSRMiddleware
   - 跑通 react-ts dev SSR demo

3. **Phase 3：webpack + rspack SSR**
   - 引入 webpack-node-externals / dev-middleware / hot-middleware
   - rspack 沿用 webpack 模式

4. **Phase 4：rollup + rolldown SSR**
   - 仅支持 build；dev 用 watch + 进程重启
   - 文档写明降级体感

5. **Phase 5：模板 + 文档**
   - cli 模板加 entry-server 占位（默认注释，仅 ssr=true 时生效）
   - docs/guide/ssr.md 完整指南

6. 回滚：每个 phase 可独立 revert；`ssr` 字段默认未启用，对老用户零影响。

## Open Questions

- `entry-server` 的 export 形态是固定 `render(url): string | Promise<string>` 还是更灵活（`render(url, ctx): { html, head, state }`）？建议第一版用 minimal `render(url): Promise<string>`，将来可扩展。
- prod 模式是否需要 service 也提供一个 server 启动器（runtime）？建议**不做**，让用户自己在 server bundle 上加 express/koa；docs 给示例。
- ssr 是否要继承 envConfig 的 alias / publicPath / css？建议**继承**，仅 ssr 子字段中的覆盖项才单独使用。
- 多入口 SPA SSR（同一 ssr.entry 但 client 多入口）是否支持？建议第一版只支持单 client 入口，文档说明限制。
