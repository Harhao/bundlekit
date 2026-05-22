## Why

仓库当前的 38 个测试全部是 shared-utils + service 层的**单元测试**（confirm / applyTools / tools-types / validate / configLoader / service）。**5 个 bundler adapter 的真实编译产物从未被自动化验证过**——SSR 双产物、库构建（target=node）、SPA dev/build 都依赖手工 demo 跑通。

`add-ssr-support` 完成后会引入 4 个新的 `createSSRMiddleware` 实现，dev SSR HTTP 路径目前没有任何验证手段。手工 curl 验证每次发版都得跑一轮，成本高且容易遗漏 bundler × 模式的某个组合。

需要建立一套 fixture-driven 的集成测试矩阵，覆盖 5 个 bundler × 4 种构建模式（SPA / Library / SSR build / SSR dev），含 dev 阶段的真实 HTTP 行为与 HMR 验证，作为 CI 的回归网。

## What Changes

- 新增 `__tests__/integration/` 目录，承载集成测试用例
- 新增 `__tests__/integration/fixtures/` 目录，包含 5 套最小项目骨架（每个 bundler 一套，复用同一份源码 + 不同 `.bundlekitrc.ts`）
- 新增 `vitest` integration 配置（`vitest.integration.config.ts`），与现有 unit 测试并行但独立 reporter / timeout
- 新增 5 个 build 测试套件：每个 bundler × {SPA build, Library build, SSR build}，断言产物文件存在 + 内容关键字 + `require()` 后导出形态
- 新增 vite/webpack/rspack 三个 dev SSR 测试套件：起 `bundlekit-service serve --bundler X` 子进程，HTTP GET `localhost:<random-port>` 拿到注水 HTML，断言含 SSR 输出标记
- 新增 vite/webpack/rspack 三个 HMR 测试套件：用 Playwright 起浏览器，编辑 fixture 源文件后断言页面无刷新地更新
- 新增 rollup/rolldown 两个 dev SSR 测试套件：起 watch + 单次 curl 验证基础渲染（不验 HMR）
- 新增 `package.json` 根级 script：`test`（unit）/ `test:integration`（fixtures + HTTP）/ `test:e2e`（Playwright HMR）
- 新增 GitHub Actions / pre-push hook 集成钩子（仅 CI 配置层级）
- BREAKING：无（纯增量测试基础设施，不改产物）

## Capabilities

### New Capabilities

- `bundler-integration-suite`: fixture-driven 的多 bundler × 多模式集成测试基础设施，含 vitest fixtures、HTTP 行为校验、Playwright HMR 验证

### Modified Capabilities

无（仅新增测试，不改任何运行时 spec）。

## Impact

- **代码**：
  - 新增根目录 `__tests__/integration/` 与子目录树
  - 新增根目录 `vitest.integration.config.ts`
  - 新增根目录 `playwright.config.ts`
  - 修改根目录 `package.json` 的 `scripts` 与 `devDependencies`
- **依赖**：新增 `playwright`（含浏览器下载）、`get-port`（动态端口）、`undici` 或复用 node native fetch（HTTP client）
- **CI**：新增 `.github/workflows/integration.yml`（如果用户希望）；本 change 不强制
- **测试时间**：单元测试保持秒级；集成测试预计 1~2 分钟（5 bundler × build 各 ~5s）；Playwright HMR 额外 ~30s
- **不影响**：所有 runtime 包代码、文档站、changeset 流程
- **依赖前置**：`add-ssr-support` 必须先收完（dev SSR runtime 才存在），`polish-create-ux` 不阻塞但建议先做（fixture 用到 PM 选择默认值时不踩坑）
