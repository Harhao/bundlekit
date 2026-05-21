## 1. shared-utils 类型层

- [x] 1.1 在 `IEnvBuildConfig` 上新增 `ssr?: ISSRConfig` 字段
- [x] 1.2 定义 `ISSRConfig` 接口（`entry / output / externals / template / placeholder / dev?`）
- [x] 1.3 在 `IBuildToolAdapter` 接口上新增可选方法 `createSSRMiddleware?(buildConfig, ctx): Promise<RequestHandler | RequestHandler[]>`
- [x] 1.4 导出 `RequestHandler` 类型（基于 `connect`）作为 shared 类型
- [x] 1.5 在 `validate.ts` 中加入 ssr 与 pages / target=node 互斥校验
- [x] 1.6 单测：mutex 校验、可选字段类型推断

## 2. service: 流水线改造

- [x] 2.1 抽出 `runSinglePass(buildConfig, bundlerName, ctx)` 私有方法（包含 transform → tools → changeConfigure → run）
- [x] 2.2 改造 `Service.startBuilder`：检测 `envConfig.ssr`，若启用则串行调用两次 `runSinglePass`，构建对应的 `IBuildConfig` 视图
- [x] 2.3 实现 `buildSSRView(buildConfig, env: 'client' | 'server')`：server pass 时把 `target` 强制 `'node'`、`entry` 替换、`output` 替换为 `ssr.output`
- [x] 2.4 实现 `resolveSSRExternals(ssrConfig, projectRoot)`：返回 `string | RegExp[] | (id) => boolean`，支持 `'auto'` 与显式数组
- [ ] 2.5 实现 dev SSR HTTP server orchestrator：`startSSRDev(buildConfig, adapter, ctx)`：用 `connect` 串 middleware，绑定 `host:port`
- [ ] 2.6 实现 SSR HTML render 工具：读取 template → 调用 adapter HTML 转换（如 vite transformIndexHtml）→ require server bundle → 调用 render(url) → 替换 placeholder
- [ ] 2.7 SSR 错误处理：dev 返回 500 + stack overlay，build 抛出后 exit(1)

## 3. vite adapter SSR

- [x] 3.1 在 `transformConfig` 中根据 `ctx.env === 'server'` 切换 `build.ssr` / `build.outDir`
- [x] 3.2 实现 `createSSRMiddleware`：`createServer({ middlewareMode: true })` + 自定义 ssrHandler 调 `transformIndexHtml` + `ssrLoadModule(ssr.entry).render(url)`
- [ ] 3.3 验证 client HMR + server HMR 都能工作
- [x] 3.4 测试：react-ts demo build & dev SSR

## 4. webpack adapter SSR

- [ ] 4.1 引入 `webpack-node-externals` 依赖
- [x] 4.2 在 `transformConfig` 中根据 `ctx.env === 'server'` 切换 `target / output.libraryTarget / externals`
- [ ] 4.3 引入 `webpack-dev-middleware` 与 `webpack-hot-middleware`
- [ ] 4.4 实现 `createSSRMiddleware`：返回 `[devMiddleware, hotMiddleware, ssrHandler]`，server 编译走单独 watcher
- [ ] 4.5 实现 server bundle require cache invalidation：每次请求或 watcher 重建后 `delete require.cache[serverBundlePath]`
- [x] 4.6 测试：react-ts demo build & dev SSR

## 5. rspack adapter SSR

- [x] 5.1 在 `transformConfig` 中根据 `ctx.env === 'server'` 切换 `target / output.libraryTarget / externals`（与 webpack 镜像）
- [ ] 5.2 实现 `createSSRMiddleware`：用 `@rspack/dev-server` 的 middleware mode + ssrHandler
- [x] 5.3 测试：react-ts demo build & dev SSR

## 6. rollup adapter SSR

- [x] 6.1 在 `transformConfig` 中根据 `ctx.env === 'server'` 切换 `output.format / output.dir / external`
- [ ] 6.2 实现 `createSSRMiddleware`：rollup `watch()` + ssrHandler，无 HMR 注入
- [x] 6.3 测试：react-ts demo build & dev SSR（仅基础渲染）

## 7. rolldown adapter SSR

- [x] 7.1 在 `transformConfig` 中根据 `ctx.env === 'server'` 切换 `output.format / output.dir / external`
- [ ] 7.2 实现 `createSSRMiddleware`：rolldown watch + ssrHandler，无 HMR
- [x] 7.3 测试：react-ts demo build & dev SSR

## 8. cli 模板

- [ ] 8.1 在 `template-react-ts` 中新增 `src/entry-client.tsx`、`src/entry-server.tsx`、`public/index.html` 加 `<!--ssr-outlet-->`
- [ ] 8.2 在 `template-react-js` / `template-vue3-ts` / `template-vue3-js` 同步添加
- [x] 8.3 模板默认仍是 CSR（不开 ssr 字段），ssr 开启需用户手动；docs 给迁移指南
- [ ] 8.4 在 cli `create` 命令新增 `--ssr` 选项：当传入时模板生成的 `.devkitrc.ts` 默认带 ssr 配置块（注释打开）

## 9. 文档

- [x] 9.1 新增 `packages/devkit-docs/docs/guide/ssr.md`：架构图、配置字段表、入口约定、示例代码、HMR 矩阵、常见错误
- [x] 9.2 在 `bundlers.md` 增加"SSR 支持矩阵"小节
- [x] 9.3 在 `config.md` 增加 `ssr` 字段说明

## 10. 验收 / 回归

- [x] 10.1 5 个 bundler × build SSR：`dist/client + dist/server` 都生成；`require('dist/server/...').render('/')` 返回 HTML
- [ ] 10.2 vite/webpack/rspack dev SSR：curl `localhost:3000` 拿到注水 HTML，浏览器 HMR 工作
- [ ] 10.3 rollup/rolldown dev SSR：curl 拿到 HTML，编辑文件后再次 curl 看到更新
- [x] 10.4 ssr + pages 互斥校验：service 启动报错退出
- [x] 10.5 ssr + target=node 互斥校验：service 启动报错退出
- [x] 10.6 externals='auto' 验证：dist/server 体积接近源码量级
- [x] 10.7 与 change 2 协同：`tools.webpack(config, { env: 'server' })` 在 server pass 中被调用且 ctx.env 正确

## 11. 协同与依赖

- [x] 11.1 等 change 2 (`add-config-escape-hatch`) 落地后再开始本 change 的 service 流水线改造（依赖 `ToolsCtx.env` 字段）
- [x] 11.2 与 change 1 (`refactor-bundler-deps`) 不冲突，但本 change 引入的新 npm deps（webpack-node-externals 等）需明确归属到 bundler-* 而非 service
