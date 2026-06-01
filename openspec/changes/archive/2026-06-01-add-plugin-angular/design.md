## Context

bundlekit 当前的"框架插件"模式是：

- 插件包导出 `apply(api, options)`，仅做一件事 —— 把 `framework` 字段写入 `buildConfig.config[env]`（见 `packages/bundlekit-plugin-react/index.ts:7-15`）。
- 7 个 bundler 适配器各自在 `transformConfig` 中读取 `framework` 字段，按值决定加载哪个生态插件 / loader / SWC 选项（见 `packages/bundlekit-bundler-vite/src/index.ts:60-73`、`packages/bundlekit-bundler-webpack/src/transformConfig.ts:196-250` 等）。
- 模板放在插件包的 `templates/template-<framework>-{ts,js}/`，由 CLI 的 `resolveTemplateDir`（`packages/bundlekit-cli/lib/commands/create/actions.ts:67-85`）通过 `require.resolve` 找到。
- SSR 由 `service` 串行做两次 build：service pass 通过 `buildSSRView`（`packages/bundlekit-shared-utils/lib/shared/ssrView.ts:14`）把 client view 转换为 server view，bundler 适配器看到 `__isServerPass=true` 就走 SSR 分支。

Angular 与 React/Vue 在编译模型上有本质差异：
- **强依赖装饰器与装饰器元数据**（`@Component`、`@Injectable` + `emitDecoratorMetadata`），SWC/Babel/TS 编译链都需要专门开关。
- **AOT 模板编译**：Angular 的 `<template>` / `templateUrl` / `styleUrls` 不是普通字符串，需要 `@angular/compiler-cli` 在编译期把模板编译成 render 函数。`@ngtools/webpack` 的 `AngularWebpackPlugin` 是 Angular CLI 自身使用的官方方案；社区在 Vite/Rollup 体系下普遍用 `@analogjs/vite-plugin-angular`。
- **SSR 渲染异步**：Angular 17+ 的 `renderApplication` 返回 `Promise<string>`，与 React `renderToString` 同步签名不一致。当前 `service` 的 SSR 渲染调用链假设同步返回 string（详见后续"开放问题 1"），需要核实并兼容。
- **Zone.js**：默认运行时强依赖 `zone.js`，必须在 bootstrap 之前 import。

约束：
- bundlekit 的设计哲学是"配置抽象 + bundler 多实现"。新增框架不能让 bundler 适配器之间出现框架特定逻辑的指数级膨胀，应保持每个 bundler 的 angular 分支独立、可降级（dynamic import 软依赖）。
- pnpm@8.15.9 workspace；Angular 不能成为 monorepo 强依赖（体积大、与其他包无关），必须以"用户项目侧依赖 + bundler 适配器内 dynamic import"的方式接入。
- 现有 React/Vue 用户零回归 —— 不允许触动 `framework === "react"` / `"vue3"` 的现有分支行为。

## Goals / Non-Goals

**Goals:**
- 用户可执行 `bc create my-app -t angular-ts -b vite` 一行起 Angular 17 standalone 项目，开箱即用 SPA + dev server + HMR。
- 加 `--ssr` 一行起 SSR 项目，client + server 双产物，dev SSR middleware 跑通（至少 vite 全双工，webpack/rspack client HMR）。
- 7 个 bundler 在 `framework === "angular"` 时都能至少完成 production build；esbuild / parcel 第一版仅保证 JIT 模式跑通即可标注实验性。
- `IBuildFramework` 类型扩展不破坏下游消费者（不做 string literal 收紧）。
- 模板支持 SPA、SSR、MPA、library 四种形态，与 React 模板对齐。
- 第一阶段（PR1）落地：plugin 包骨架 + 类型扩展 + CLI 注册 + vite 适配 + angular-ts/js 模板 + vite SSR fixture + 文档骨架。

**Non-Goals:**
- **不支持 NgModule 老体系**。模板仅生成 standalone components + `bootstrapApplication` 形态，不维护 `AppModule` 路径。用户若有 NgModule 项目可手动迁移。
- **不内置 Angular Router / Forms / HttpClient 选择**。模板默认仅 `@angular/core` + `@angular/platform-browser`，路由 / SSR 路由 / Forms 由用户自行 `pnpm add @angular/router` 后接入。
- **不支持 Angular i18n** AOT message extraction（属于 Angular CLI 重度集成场景，超出 bundlekit 边界）。
- **不接 Angular Universal `ng-add` 体系**：bundlekit SSR 走自己的 client/server 双 pass，不复用 Angular Universal 的 server.ts express 模板。
- **不做 Angular DevKit BuilderContext 兼容**：用户不能用 `ng build` 命令跑 bundlekit 项目；命令链固定走 `bundlekit-service serve/build`。
- **第一版不做 zoneless 模板**（Angular 17+ 实验态、生态兼容性差）。
- **第一版不做 Angular Material / CDK 模板预设**（用户后置安装即可）。

## Decisions

### Decision 1：锁定 Angular 17+ standalone

**选择**：模板与文档统一基于 Angular 17.x 的 standalone components + `bootstrapApplication` + `provideClientHydration()` + `renderApplication`。

**理由**：
- Angular 17 是 standalone 体系的第一个稳定版（默认配置就是 standalone），向前兼容 18 / 19。
- standalone 形态可以省掉 NgModule 维护成本，模板代码量与 React 同级。
- `renderApplication` 是 SSR 官方推荐 API，配合 `provideClientHydration()` 可获得 non-destructive hydration（与 React 18 的 `hydrateRoot` 语义对齐）。

**替代方案**：
- Angular 16 + NgModule：模板复杂度翻倍，`AppModule.ts` + `AppServerModule.ts` 维护成本高，且 Angular 17 已稳定一年余，无业务理由停留旧版。
- Angular 18 + zoneless：实验态、文档不全、生态库（如 router、form）与 zoneless 兼容性参差，第一版风险过高。

### Decision 2：vite/rollup/rolldown 体系用 `@analogjs/vite-plugin-angular`

**选择**：vite、rollup、rolldown 三个 bundler 在 `framework === "angular"` 时通过 dynamic import 加载 `@analogjs/vite-plugin-angular`。

**理由**：
- analogjs 是 Angular 社区在 Vite 生态的事实标准，由 Angular team 成员参与维护，处理装饰器、AOT 模板、`@Component` 内联样式、HMR、SSR 转译。
- 该插件实现遵循 rollup-API 兼容 plugin 接口，rolldown 与 rollup 均可直接复用。
- 与现有 Vue3 分支调用 `@vitejs/plugin-vue` 的模式完全对齐，bundler 代码改动量最小。

**替代方案**：
- 自己手写 typescript-plugin + decorator-metadata transform：维护成本极高，AOT 模板编译需要嵌 `@angular/compiler-cli`，等于重写 ng build。
- 复用 `@ngtools/webpack`：webpack-only API，无法在 vite/rollup 上跑。

### Decision 3：webpack/rspack 用 `@ngtools/webpack` 的 `AngularWebpackPlugin`

**选择**：webpack 与 rspack 在 `framework === "angular"` 时使用 `@ngtools/webpack`（Angular CLI 自身使用的方案）。

**理由**：
- `AngularWebpackPlugin` 是 Angular team 维护的官方 webpack 集成，AOT 编译、装饰器元数据、模板/样式 inline、tree-shaking 全包。
- rspack 在 webpack plugin API 兼容性上覆盖了 `AngularWebpackPlugin` 所需的所有 hook（compilation tap、resolver hooks），可以直接复用；如遇兼容性问题再做 polyfill。
- 与现有 webpack 分支注册 `vue-loader` + `VueLoaderPlugin` 的模式同构。

**替代方案**：
- ts-loader + ttypescript + `@angular/compiler-cli`：可行但配置链复杂，且 ttypescript 维护停滞。
- swc-loader + decorator-metadata：rspack 内部 SWC 已开 decorators，但模板 AOT 仍需另一套 plugin，不如直接复用官方。

### Decision 4：esbuild/parcel 第一版仅支持 JIT，标注实验性

**选择**：esbuild 与 parcel 在 `framework === "angular"` 时走 JIT 路径（运行时 `@angular/compiler` 编译模板），并在 logger 输出 `experimental: angular on <bundler> uses JIT mode, bundle size will be larger`。

**理由**：
- esbuild 原生支持 TypeScript decorators（`tsconfig.experimentalDecorators=true` + `useDefineForClassFields=false`），但不做 AOT 模板编译。社区有 `esbuild-angular` 等方案但维护停滞。
- parcel 的 Angular 支持自 Parcel 2 后断档；引入 unmaintained plugin 风险高。
- JIT 模式可以保证用户能跑起来 demo，bundle 体积大但功能完整；后续迭代可评估接 AOT。
- 第一版交付优先级明确：vite/webpack/rspack 是用户主流场景，esbuild/parcel 标注实验性不影响核心体验。

**替代方案**：
- 直接拒绝 esbuild/parcel + angular 组合：用户体感差（"bundlekit 号称 7 bundler 全支持，怎么 angular 漏俩？"）。
- 等 AOT 方案成熟再加：阻塞 PR3 交付节奏，且 vite/webpack/rspack 已可解决 90% 场景。

### Decision 5：模板 SSR 入口设计

**选择**：模板生成的 `entry-server.ts` 暴露 `export async function render(url: string): Promise<string>`，service 的 SSR 渲染调用方需 `await render(url)`。

**理由**：
- Angular 17 `renderApplication` 返回 `Promise<string>`，无法同步包装。
- 当前 React `entry-server.tsx` 返回同步 string；service / shared-utils 的 `createSSRRequestHandler` 调用链需要兼容 sync + async。改造方案：把渲染函数返回值统一包成 `Promise.resolve(...)` 后 await，对现有 React 用户透明、零回归。
- 该改造即使没有 Angular 也是正确的，因为 Vue 的 `renderToString` 实际也返回 Promise。Angular 接入是把这个隐性 bug fix 显式化的契机。

**替代方案**：
- 强制 Angular 模板用 `renderApplicationSync`（不存在）—— 不可行。
- 在 plugin-angular 内部包一个 sync 适配层：会触发 Angular 警告"renderApplication called synchronously"，且需要 `deasync` / 死循环等待，工程上不合理。

### Decision 6：plugin 包内不预装 Angular 依赖

**选择**：`@bundlekit/plugin-angular` 自己 `package.json` 仅依赖 `@bundlekit/shared-utils`；`@angular/*` 与 `@analogjs/vite-plugin-angular` / `@ngtools/webpack` 全部走"用户项目侧 deps + bundler dynamic import"。

**理由**：
- 与现有 plugin-react / plugin-vue 模式一致（plugin-vue 不预装 vue，bundler-vite 内 `await import("@vitejs/plugin-vue")` 软依赖）。
- 避免 bundlekit monorepo `node_modules` 因为单个少用插件膨胀几十 MB。
- 用户项目模板 `package.json.ejs` 显式声明 `@angular/*` 与 SSR 时的 `@angular/platform-server`，安装关系清晰。

**替代方案**：
- 在 plugin-angular 加 `peerDependencies`：会让所有装了 `@bundlekit/plugin-angular` 的项目被 pnpm 提示 missing peer，反而困扰用户。

### Decision 7：MPA = 多入口多 bootstrap

**选择**：Angular MPA 模板每个 page 一个独立的 `bootstrapApplication(PageRoot)` 入口文件，配合 bundlekit 现有的 `pages[]` 配置直接落到多个 chunk + 多个 HTML 模板。

**理由**：
- 与 React MPA 同构（每个 page 一个 ReactDOM.createRoot 入口）。
- 不引入 Angular Router 依赖，零路由配置即可起 MPA，最小可用。

**替代方案**：
- 用 Angular Router + lazy-load：把多页变伪多页（仍是 SPA）。语义不符 MPA，且强引 router 依赖。

## Risks / Trade-offs

- **[风险] Angular 编译生态分裂导致维护成本高**：vite/rollup/rolldown 用 analogjs，webpack/rspack 用 ngtools，esbuild/parcel 用 JIT。三套机制对应版本号需独立追踪。
  → **缓解**：bundler 适配器内部 dynamic import 时 try/catch + warn 降级，用户不至于被一个边角 bundler 升级阻塞；同时 `__tests__/integration/fixtures/<bundler>/` 提供 angular fixture 跑通检查，CI 一旦回归立刻可见。

- **[风险] `IBuildFramework` 类型扩展是 minor breaking**：下游消费者若用 `switch(framework)` 穷举且开启 `noFallthroughCasesInSwitch`，编译器会报漏处理 angular。
  → **缓解**：本仓库内 7 个 bundler 都在本次 PR 同步加 `case "angular":`；外部 plugin 作者通过 changeset minor 升级显式提示。changeset description 写明 "If you have third-party bundler adapter, add `case 'angular'` branch."

- **[风险] SSR async render 兼容改造可能影响 React/Vue 现有路径**：service 把 sync `string` 调用改 `await Promise.resolve(string)`。
  → **缓解**：在 `__tests__/integration/dev-ssr` 与 `build` 套件中保留 React + Vue SSR 跑通断言；仅在 createSSRRequestHandler 调用点改 `await`，不动模板侧。

- **[风险] Angular 17 → 18/19 升级可能导致 analogjs 与 ngtools 不同步**：新 Angular minor 发布后，社区插件需要 1-4 周追上。
  → **缓解**：模板 `package.json.ejs` 锁 `^17.0.0`（不开 ^18 自动跳跃）；docs 注明用户升级 Angular 主版本前先看 bundlekit changelog。

- **[风险] esbuild/parcel JIT 模式 bundle 体积可能比 AOT 大 30-50%**：用户可能误以为 bundlekit 不优化。
  → **缓解**：production build 时 logger 显式 warn `JIT mode, bundle size larger`，docs 的 SSR 矩阵表标注 esbuild/parcel = "experimental, JIT-only"。

- **[权衡] 不支持 NgModule 老项目**：约 30% 存量 Angular 项目仍是 NgModule。
  → 显式 non-goal，docs 写明"如需迁移 NgModule 项目，请先 standalone 化再使用 bundlekit"。

- **[权衡] 不内置 Router/Forms/HttpClient**：用户起项目后还要至少 `pnpm add @angular/router`。
  → 与 React 模板"不内置 react-router"的策略一致；通过文档示例补足体验。

## Migration Plan

由于 Angular 是新增能力，没有"已有 angular 用户"需要迁移。但 React/Vue 现有用户可能因 SSR async render 改造受到隐性影响：

1. **PR1 落地**：plugin-angular 包骨架 + vite 适配 + 模板 + CLI 注册 + 文档骨架。
   - 同步在 `service` / `shared-utils` 调用链中把 SSR `render(url)` 调用改为 `await render(url)`，且 `__tests__/integration/dev-ssr` 跑 React/Vue/Angular 三套 fixture 全绿。
   - 发 minor 版本，changeset 标注：`Add @bundlekit/plugin-angular (Angular 17+ standalone), expand IBuildFramework type, SSR render now supports async functions.`
2. **PR2 落地**：webpack + rspack adapter 接入 `@ngtools/webpack`，`__tests__/integration/fixtures/{webpack,rspack}/.bundlekitrc.{spa,ssr}.ts` 加 angular 场景。
3. **PR3 落地**：rollup / rolldown / esbuild / parcel adapter 接入；docs SSR 矩阵更新 angular 行；esbuild/parcel 标注实验性。
4. **回滚策略**：若 PR1 上线后发现 SSR async 改造引发 React/Vue 用户回归，立即 patch 版本回退该改造点（保留 plugin-angular 但暂时把 angular 的 SSR 渲染包成同步 fallback：起一个 worker_thread 跑 `await renderApplication()`）。

## Open Questions

1. **service / shared-utils 现有 SSR 渲染调用是同步还是异步？** 需在实施 PR1 第一步先扫 `createSSRRequestHandler` / `Service.ts:401` 附近，确认 render 调用形态。若已是 `await render(url)`，本次 Decision 5 改造为 no-op；否则需要小改造（已纳入 tasks）。

2. **rspack 是否真的兼容 `@ngtools/webpack` 的所有 hook？** 计划在 PR2 启动时先用最小 fixture 跑通验证；若不兼容，fallback 到 swc-loader + 自定义 angular template plugin（PR2 风险增大约 1-2 天）。

3. **template-angular-js 的实际价值？** Angular 几乎无人用 JS。已决策仍要做以保持与 React/Vue 模板对称，但模板内容会偏简略（不含 type-only 演示）。

4. **MCP 模板列表更新位置**：`packages/bundlekit-cli-mcp/` 是否有独立的 templates 枚举？需在 PR1 实施前 grep 一次确认。已纳入 tasks 的"CLI MCP 同步"项。
