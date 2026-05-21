## 1. 基础设施搭建（Phase 1）

- [x] 1.1 在仓库根目录创建 `__tests__/integration/` 目录树（`fixtures/`、`build/`、`dev-ssr/`、`e2e/`、`helpers/`）
- [x] 1.2 写 `vitest.integration.config.ts`：testTimeout 60s、pool='forks'、maxConcurrency=2、include 仅 integration 目录
- [x] 1.3 根目录 `package.json` 加 scripts：`test:integration`、`test:e2e`、`test:all`
- [x] 1.4 根目录 `package.json` 加 devDependencies：`get-port@7`、`@playwright/test@latest`
- [x] 1.5 写 `__tests__/integration/helpers/port.ts`：封装 `getPort()`
- [x] 1.6 写 `__tests__/integration/helpers/fixture.ts`：实现 `copyFixture(name): tmpDir` + teardown
- [x] 1.7 写 `__tests__/integration/helpers/spawnService.ts`：spawn child + waitForLog + kill
- [x] 1.8 写 `__tests__/integration/helpers/fetch.ts`：封装 node fetch 用例方法

## 2. fixtures 共享源码（Phase 1）

- [x] 2.1 写 `__tests__/integration/fixtures/shared/src/App.tsx`：单组件，包含 `__SSR_MARKER__` 字符串
- [x] 2.2 写 `__tests__/integration/fixtures/shared/src/entry-client.tsx`：hydrateRoot
- [x] 2.3 写 `__tests__/integration/fixtures/shared/src/entry-server.tsx`：export render(url)
- [x] 2.4 写 `__tests__/integration/fixtures/shared/src/index.ts`：Library 入口
- [x] 2.5 写 `__tests__/integration/fixtures/shared/public/index.html`：含 `<!--ssr-outlet-->`
- [x] 2.6 写 `__tests__/integration/fixtures/shared/tsconfig.json`、`package.json`（react/react-dom）

## 3. fixtures 每 bundler 配置（Phase 1）

- [x] 3.1 创建 `fixtures/webpack/.devkitrc.spa.ts` / `.devkitrc.lib.ts` / `.devkitrc.ssr.ts` + package.json（指 devkit-service file:）
- [x] 3.2 创建 `fixtures/vite/` 同款 3 份配置
- [x] 3.3 创建 `fixtures/rspack/` 同款
- [x] 3.4 创建 `fixtures/rollup/` 同款
- [x] 3.5 创建 `fixtures/rolldown/` 同款
- [x] 3.6 跑通"vite-spa 最小冒烟"：spawnService + fetch 拿到 200，证明管道工作

## 4. build 矩阵 — SPA + Library（Phase 2）

- [x] 4.1 写 `__tests__/integration/build/webpack-spa.test.ts`：build → 断言产物 + 关键字
- [x] 4.2 写 `webpack-library.test.ts`：target=node → require 断言 export
- [x] 4.3 写 `vite-spa.test.ts` / `vite-library.test.ts`
- [x] 4.4 写 `rspack-spa.test.ts` / `rspack-library.test.ts`
- [x] 4.5 写 `rollup-spa.test.ts` / `rollup-library.test.ts`
- [x] 4.6 写 `rolldown-spa.test.ts` / `rolldown-library.test.ts`（rolldown 用例可加 `test.skipIf` 兜底）
- [x] 4.7 全 10 个 SPA + Library 测试全过

## 5. build 矩阵 — SSR build（Phase 3，依赖 add-ssr-support build 路径已完成）

- [x] 5.1 写 `webpack-ssr.test.ts`：双 pass → require dist/server/server.cjs.render('/')
- [x] 5.2 写 `vite-ssr.test.ts`
- [x] 5.3 写 `rspack-ssr.test.ts`
- [x] 5.4 写 `rollup-ssr.test.ts`
- [x] 5.5 写 `rolldown-ssr.test.ts`
- [x] 5.6 全 5 个 SSR build 测试全过

## 6. dev SSR HTTP 矩阵（Phase 4，依赖 add-ssr-support createSSRMiddleware 完成）

- [x] 6.1 写 `__tests__/integration/dev-ssr/vite-curl.test.ts`：spawn serve → HTTP GET → 断言 SSR_MARKER + hydrate script
- [x] 6.2 写 `webpack-curl.test.ts`
- [x] 6.3 写 `rspack-curl.test.ts`
- [x] 6.4 写 `rollup-curl.test.ts`：仅基础渲染、无 HMR runtime
- [x] 6.5 写 `rolldown-curl.test.ts`：同 rollup
- [x] 6.6 全 5 个 dev SSR HTTP 测试全过

## 7. HMR Playwright（Phase 5，依赖 Phase 4）

- [x] 7.1 写 `playwright.config.ts`：仅 chromium，testDir=`__tests__/integration/e2e`
- [x] 7.2 docs README 写明 `pnpm playwright install --with-deps chromium` 一次性步骤
- [x] 7.3 写 `e2e/hmr-vite.spec.ts`：navigate → editFile → 断言更新且 navigationCount 不变
- [x] 7.4 写 `e2e/hmr-webpack.spec.ts`
- [x] 7.5 写 `e2e/hmr-rspack.spec.ts`
- [x] 7.6 helper `editFile(path, find, replace)` 用 try-finally 还原
- [x] 7.7 全 3 个 HMR 测试全过 + git diff fixtures 干净

## 8. CI 集成（可选）

- [ ] 8.1 加 `.github/workflows/integration.yml`（unit 在 PR check，integration 仅 main 触发）
- [ ] 8.2 配置 actions/cache 缓存 `__tests__/integration/.cache/node_modules`
- [ ] 8.3 Playwright 浏览器走 actions/setup-node 缓存
- [ ] 8.4 失败时上传 vitest reporter 与 playwright trace 作为 artifact

## 9. 文档与收尾

- [x] 9.1 写 `__tests__/integration/README.md`：目录结构、本地运行、添加新测试的步骤
- [ ] 9.2 在 `docs/guide/` 加一节"如何贡献集成测试"
- [x] 9.3 写 `.changeset/add-bundler-integration-suite.md`，标记 patch（仅基础设施，不影响产物）
- [x] 9.4 跑 `openspec validate add-bundler-integration-suite --strict` 通过
