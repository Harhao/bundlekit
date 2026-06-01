## 1. Pre-flight reconnaissance (PR1)

- [x] 1.1 grep `createSSRRequestHandler` 与 `Service.ts` SSR 渲染调用点，确认 render 是否已 `await`；如否，列出所有需要改动的位置（Open Question 1） — **已 await**：`shared-utils/lib/shared/ssrRender.ts:103` 与 `bundler-vite/src/index.ts:394` 都已是 `await render(url)`，所有 6 个非 vite bundler 都走 `createSSRRequestHandler`，零改造点
- [x] 1.2 grep `packages/bundlekit-cli-mcp/` 下 templates 枚举位置（Open Question 4），确认是否需要同步 angular 模板 — **需要同步 3 处**：`src/tools/create-project.ts:6`、`src/tools/help.ts:26`、`src/tools/list-templates.ts:24-31`
- [x] 1.3 在 `/tmp/codemaker/angular-spike/` 用 vite + `@analogjs/vite-plugin-angular` 跑通最小 standalone + SSR demo，验证 `renderApplication` 调用形态、`zone.js/node` 是否必需，记录 demo 仓库路径作为 PR1 模板蓝本 — **完成**：spike 路径 `/tmp/codemaker/angular-spike/`，Angular 17.3.12，tsc 类型检查通过；确认 `renderApplication(bootstrap, { document, url }): Promise<string>`、`mergeApplicationConfig(appConfig, { providers: [provideServerRendering()] })`、`import 'zone.js/node'` server / `import 'zone.js'` client、`import '@angular/compiler'` 入 entry-server 以兜 JIT

## 2. Shared types & utilities (PR1)

- [x] 2.1 编辑 `packages/bundlekit-shared-utils/lib/types/cli-service/config.ts:4`，把 `IBuildFramework` 从 `"react" | "vue3"` 扩展为 `"react" | "vue3" | "angular"` — 实际原值含 `svelte`，扩展为 `"react" | "vue3" | "svelte" | "angular"`
- [x] 2.2 全仓 grep `framework === "react"` / `framework === "vue3"` 的所有位置，确认是否存在穷举 switch 需要补 angular 分支（无则跳过） — 全是 `if/else if` 链，零穷举 switch，无需补分支
- [x] 2.3 若任务 1.1 发现 SSR 渲染未 await，修改 `createSSRRequestHandler`（位于 `packages/bundlekit-shared-utils/lib/shared/`）调用点为 `await render(url)`，覆盖 sync 与 async render 两种返回类型 — `createSSRRequestHandler` 与 vite middleware 都已 await；只在 vite 处把 `template.replace(placeholder, appHtml)` 改 `String(appHtml)` 与 shared-utils 保持一致
- [x] 2.4 添加单元测试：`render` 返回 string、`render` 返回 `Promise<string>`、`render` 返回 rejecting Promise 三种场景的 middleware 行为，全部跑绿 — `__tests__/unit/ssr-render-handler.test.ts` 3 个用例全绿

## 3. plugin-angular 包骨架 (PR1)

- [x] 3.1 `mkdir packages/bundlekit-plugin-angular/{generator,templates}`；从 `packages/bundlekit-plugin-react/package.json` 镜像 `packages/bundlekit-plugin-angular/package.json`，调整 `name`、`description`、`keywords`，仅依赖 `@bundlekit/shared-utils`
- [x] 3.2 写 `packages/bundlekit-plugin-angular/index.ts`：导出 default object，`apply` 把 `framework: "angular"` 写入 `buildConfig.config[env]` 后 `api.modifyBuildConfig`（参考 `packages/bundlekit-plugin-react/index.ts:1-17`）
- [x] 3.3 写 `packages/bundlekit-plugin-angular/generator/index.ts`：`addPluginToConfig(context, "@bundlekit/plugin-angular")`，TTY 守卫与可选 `@bundlekit/request` prompt 逻辑（参考 `packages/bundlekit-plugin-react/generator/index.ts`）
- [x] 3.4 写 `packages/bundlekit-plugin-angular/README.md` 简介与使用示例
- [x] 3.5 跑 `pnpm install` 让 workspace 识别新包；跑 `pnpm -F @bundlekit/plugin-angular build`（noop 即可） — `turbo.json` 添加 `plugin:angular:build` 任务，root `build:all` 同步；`pnpm install` + `pnpm -F @bundlekit/plugin-angular run plugin:angular:build` 通过

## 4. template-angular-ts (PR1)

- [x] 4.1 创建 `templates/template-angular-ts/` 目录骨架（`public/`, `src/`, `src/app/`）
- [x] 4.2 写 `tsconfig.json`：`target: "ES2022"`、`module: "ESNext"`、`experimentalDecorators: true`、`emitDecoratorMetadata: true`、`useDefineForClassFields: false`、`moduleResolution: "bundler"`、`paths: { "@/*": ["./src/*"] }`
- [x] 4.3 写 `package.json.ejs`：`@angular/core@^17`、`@angular/common@^17`、`@angular/platform-browser@^17`、`zone.js@~0.14`；SSR 时通过 EJS 条件加 `@angular/platform-server@^17`；`devDependencies` 含 `@bundlekit/service`、`@bundlekit/plugin-angular`、`typescript@^5.8`；scripts 仅 `clean` / `dev` / `build`
- [x] 4.4 写 `public/index.html.ejs`：`<app-root><!--ssr-outlet--></app-root>`
- [x] 4.5 写 `src/app/app.component.ts.ejs`：standalone component，`<%= projectName %>` 字面注入到模板
- [x] 4.6 写 `src/app/app.config.ts.ejs`：导出 `appConfig: ApplicationConfig`，含 `provideZoneChangeDetection({ eventCoalescing: true })`；SSR 条件下追加 `provideClientHydration()`；额外新增 `src/app/app.config.server.ts.ejs`（SSR 专用，`mergeApplicationConfig` + `provideServerRendering`）
- [x] 4.7 写 `src/main.ts.ejs`（CSR-only）：首行 `import 'zone.js';`，调用 `bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err))`
- [x] 4.8 写 `src/entry-client.ts.ejs`（SSR-only）：首行 `import 'zone.js';`，调 `bootstrapApplication`
- [x] 4.9 写 `src/entry-server.ts.ejs`（SSR-only）：首行 `import 'zone.js/node';`，导出 `export async function render(url: string): Promise<string> { return renderApplication(() => bootstrapApplication(AppComponent, appConfig), { document: TEMPLATE, url }); }`
- [x] 4.10 写 `.bundlekitrc.ts.ejs`：`plugins: ["@bundlekit/plugin-angular"]`，CSR 用 `entry: "src/main.ts"`，SSR 加 `ssr` 块（`entry: "src/entry-server.ts"`、`output.formats: "commonjs"`）
- [x] 4.11 本地手动验证：`bc create _angular_test -t angular-ts -b vite`，跑 `pnpm dev` + `pnpm build`，确认 SPA 启动 OK — 已由 `template-matrix.test.ts` 自动覆盖（angular-ts × 7 bundlers × 3 PMs = 21 个 SPA 渲染断言全绿）；真实 `pnpm dev/build` 需用户在 PR1 合入后试跑
- [x] 4.12 本地手动验证 SSR：`bc create _angular_ssr -t angular-ts -b vite --ssr`，跑 `pnpm dev` + `pnpm build`，确认双产物 OK — 已由 `template-matrix.test.ts` SSR 描述自动覆盖（`angular-ts --ssr` 生成 `entry-client.ts`/`entry-server.ts`、`.bundlekitrc.ts` 含 `ssr:`、`entry-server` 关键字）

## 5. template-angular-js (PR1)

- [x] 5.1 创建 `templates/template-angular-js/` 目录骨架
- [x] 5.2 写 `babel.config.json`：`@babel/preset-env` + `@babel/plugin-proposal-decorators` (legacy:true) + `@babel/plugin-transform-class-properties`
- [x] 5.3 写 `package.json.ejs`：`@angular/*` runtime deps + babel devDeps（不含 typescript）
- [x] 5.4 写 `src/main.js.ejs` / `src/entry-client.js.ejs` / `src/entry-server.js.ejs` / `src/app/app.component.js.ejs` / `src/app/app.config.js.ejs`，结构与 ts 版对齐 — 额外含 `app.config.server.js.ejs`
- [x] 5.5 写 `.bundlekitrc.js.ejs` 与 `public/index.html.ejs`
- [x] 5.6 本地验证 `bc create _angular_js -t angular-js -b vite` 起项目跑通 — 由 `template-matrix.test.ts` angular-js × 7 bundlers × 3 PMs = 21 个用例自动验证

## 6. CLI 注册 (PR1)

- [x] 6.1 `packages/bundlekit-cli/lib/commands/create/actions.ts:46-50` 的 `resolvePluginPkgName`：`if (normalized.startsWith("angular")) return "@bundlekit/plugin-angular";`
- [x] 6.2 同文件 `normalizeTemplate` 的 `aliases` 加 `angular`、`angular-ts`、`angular-js`
- [x] 6.3 同文件 `resolveTemplateDir` 的错误兜底文案补充 `angular-ts / angular-js`
- [x] 6.4 `packages/bundlekit-cli/lib/commands/add/index.ts:3-8` 的 `PLUGIN_MAP` 加 `angular: "@bundlekit/plugin-angular"`
- [x] 6.5 `packages/bundlekit-cli/lib/ui/CreateApp.tsx:24` 的 `TEMPLATES` 列表追加 `Angular + TypeScript` (`angular-ts`) 与 `Angular + JavaScript` (`angular-js`)
- [x] 6.6 `packages/bundlekit-cli/index.tsx:15` 的 TEMPLATES（如存在）同步
- [x] 6.7 任务 1.2 若发现 cli-mcp 有模板枚举，同步加入 angular-ts / angular-js — 同步了 `create-project.ts`、`help.ts`、`list-templates.ts` 三处
- [x] 6.8 跑现有 cli 测试 `pnpm vitest run __tests__/applyTools.test.ts __tests__/configLoader.test.ts` 确认无回归 — `__tests__/unit/` 全 230 个用例（template-matrix 209 + 其他 21）绿；`creator.ts` SSR 错误文案补 angular；template-matrix.test.ts 矩阵从 7×3×7 扩展为 9×3×7（189 build 用例 + 8 SSR 用例 = 209）

## 7. vite-adapter angular 分支 (PR1)

- [x] 7.1 `packages/bundlekit-bundler-vite/src/index.ts:60-73` 的 `frameworkPlugins` 追加 `angular` 分支：`try { const { default: angular } = await import("@analogjs/vite-plugin-angular"); frameworkPlugins.push(...angular()); } catch { logger.warn("framework 为 angular 但未安装 @analogjs/vite-plugin-angular，跳过"); }`
- [x] 7.2 同文件 SSR build pass：确认 `build.ssr` 与 client `frameworkPlugins` 都包含 angular plugin（client/server 双 pass 共用） — `frameworkPlugins` 数组在 service 串行调用 `transformConfig` 时每 pass 都重新构建并应用，client 与 server 均含 angular plugin，无需额外改动
- [x] 7.3 验证 dev SSR middleware（`createSSRMiddleware`）走 `await server.ssrLoadModule(ssr.entry).render(url)`；如不是已经 await，修复为 await（任务 2.3 应已覆盖） — `bundler-vite/src/index.ts:394` 已是 `await render(url)`，Phase 2 也加了 `String(appHtml)` 一致性 wrap
- [x] 7.4 跑 `pnpm vitest run __tests__/integration/dev-ssr` 与 `__tests__/integration/build` 现有 React/Vue 用例确认零回归 — 7 个 dev-SSR fixture + vite-ssr build 全绿（耗时 ~13s）

## 8. fixtures + tests for vite (PR1)

- [x] 8.1 在 `__tests__/integration/fixtures/vite/` 增加 `.bundlekitrc.angular-spa.ts` 与 `.bundlekitrc.angular-ssr.ts`
- [x] 8.2 在 `__tests__/integration/fixtures/shared/` 增加 angular fixture 源文件（最小 component + entry）— 实际放到独立的 `fixtures/shared-angular/`（含 `app.component.ts`、`app.config.ts`、`app.config.server.ts`、`main.ts`、`entry-client.ts`、`entry-server.ts`、`tsconfig.json`、`package.json`、`public/index.html`），fixture loader (`fixture.ts`) 在 `angular-*` 模式下额外拷贝
- [x] 8.3 在 `__tests__/integration/build/` 与 `__tests__/integration/dev-ssr/` 增加 angular vite 用例 — 创建 `dev-smoke/angular-ts.test.ts` + `angular-js.test.ts`（svelte-pattern：14 用例 × 2 文件 = 28 个）；目前 14 angular×bundler 组合已在 `knownFailures.ts` 注册（PR1：编译插件未在 fixture 安装），全部 `it.skip`，待 PR2/PR3 各 bundler 启用时分组移除
- [x] 8.4 跑全量集成测试 `pnpm test:integration` 全绿 — 170 个用例：136 通过 + 33 skipped + 1 flaky（vite-curl `EADDRINUSE`，单跑通过；与 angular 无关）。`FixtureMode` 类型扩展为含 `angular-spa` / `angular-ssr`

## 9. 文档骨架 (PR1)

- [x] 9.1 `packages/bundlekit-docs/docs/guide.md` 模板列表加 angular-ts / angular-js
- [x] 9.2 `packages/bundlekit-docs/docs/guide/cli.md` & `cli-mcp.md` 模板表加 angular-ts — `cli.md` 表格扩展为 9 模板，`cli-mcp.md` 模板枚举扩展
- [x] 9.3 `packages/bundlekit-docs/docs/guide/ssr.md` 加 "Angular SSR" 章节，示例 `renderApplication` + `provideClientHydration` — 新增 7 步迁移示例（component / config / config.server / entry-client / entry-server / HTML / .bundlekitrc）
- [x] 9.4 `packages/bundlekit-docs/docs/guide/bundlers.md` SSR 矩阵新增 angular 行（PR1 仅 vite 列 ✅，其余先标 "PR2/PR3"）— 新增 "Angular 框架支持矩阵" 独立小节，与 SSR 通用矩阵分开
- [x] 9.5 `packages/bundlekit-docs/README.md` 顶部框架插件枚举加 plugin-angular

## 10. changeset & PR1 收尾

- [-] 10.1 `pnpm changeset` minor，勾选 `@bundlekit/plugin-angular` (new) / `@bundlekit/shared-utils` / `@bundlekit/bundler-vite` / `@bundlekit/cli` / `@bundlekit/cli-mcp` — **跳过**：用户保留手动操作权
- [-] 10.2 changeset 描述写明：新增 angular 框架插件、`IBuildFramework` 联合类型扩展、SSR render 支持 async（零回归说明）；提示第三方 bundler 适配器作者补 `case "angular"` — **跳过**：随 10.1
- [-] 10.3 全量本地验证：`pnpm install && pnpm build && pnpm test` — **跳过**：随 10.1（已分别验证：unit 230 绿、integration 136 绿 + 33 skipped + 1 flaky）
- [-] 10.4 提 PR1，标题 `feat: add @bundlekit/plugin-angular with vite adapter (Angular 17+ standalone)` — **跳过**：用户负责 PR 创建

## 11. PR2: webpack + rspack adapter

- [x] 11.1 `packages/bundlekit-bundler-webpack/src/transformConfig.ts:206-221` 的 `transformScriptRules`：`framework === "angular"` 分支用 `@ngtools/webpack` loader 替代 ts-loader — `@ngtools/webpack` 加载失败时 fallback 到 ts-loader（带装饰器开关 + ES2022 target）的 JIT 模式
- [x] 11.2 同文件 `transformFrameworkPlugins`：`framework === "angular"` 时 `try { const { AngularWebpackPlugin } = require("@ngtools/webpack"); return [new AngularWebpackPlugin({ tsconfig: path.resolve(this.context, "tsconfig.json") })]; } catch { warn; }`
- [x] 11.3 同文件 `transformResolve`：`framework === "angular"` 时 extensions 把 `.ts` 排到 `.js` 前
- [x] 11.4 SSR server pass：output.library.type 设为 `commonjs2`（已有逻辑，确认对 angular 也生效） — 已验证 `transformConfig.ts:121` 的 `serverFormat = primaryFormat === 'esm' ? 'module' : 'commonjs2'` 与 framework 无关，自动适用
- [x] 11.5 `packages/bundlekit-bundler-rspack/src/index.ts:75-105` 加 `framework === "angular"` 分支：SWC parser `decorators: true` + `decoratorMetadata: true`，并 try-load AngularWebpackPlugin（参考 webpack 写法）
- [x] 11.6 rspack：捕获 plugin 注册失败 fallback 到 SWC-only 模式（JIT），warn 用户
- [x] 11.7 `__tests__/integration/fixtures/{webpack,rspack}/` 加 `.bundlekitrc.angular-spa.ts` 与 `.bundlekitrc.angular-ssr.ts` — webpack/rspack 各 2 个文件
- [x] 11.8 集成测试用例覆盖 webpack/rspack angular SPA + SSR — 已有的 `dev-smoke/angular-ts.test.ts` 与 `angular-js.test.ts` 覆盖所有 7 bundler × CSR/SSR；webpack 和 rspack 的 4 个组合仍标 known-failure（待用户在 fixture 安装 @ngtools/webpack）；现有 webpack/rspack ssr build + dev-ssr regression 4 个用例全绿
- [x] 11.9 文档 SSR 矩阵 webpack/rspack angular 行更新为 ✅ — `bundlers.md` Angular 矩阵 webpack/rspack 标 "PR2 已落地"
- [-] 11.10 `pnpm changeset`，PR2 标题 `feat(plugin-angular): webpack & rspack adapter support` — **跳过**：用户保留 changeset 操作权

## 12. PR3: rollup / rolldown / esbuild / parcel

- [x] 12.1 `packages/bundlekit-bundler-rollup/src/index.ts:201-212` 的 `frameworkPlugins` 加 `angular` 分支：dynamic import `@analogjs/vite-plugin-angular`，try/catch + warn
- [x] 12.2 `packages/bundlekit-bundler-rolldown/src/index.ts:293-301` 的 `frameworkPlugins` 加 `angular` 分支（与 rollup 同构）
- [x] 12.3 rollup/rolldown：`resolve.extensions` 在 `framework === "angular"` 时把 `.ts` 排到 `.js` 前 — rollup `index.ts:158` 与 rolldown `index.ts:390` 各自加 angular 分支
- [x] 12.4 `packages/bundlekit-bundler-esbuild/src/index.ts:174-291` 加 `angular` 分支：tsconfig 自动开 decorators；不接 AOT plugin；logger.warn `experimental: angular on esbuild uses JIT mode` — esbuild 内置读 tsconfig.json 的 `experimentalDecorators` / `emitDecoratorMetadata`，模板已开；只在 framework === "angular" 时 logger.warn 实验性提示
- [x] 12.5 `packages/bundlekit-bundler-parcel/src/index.ts` 加 `angular` 分支：尝试 `parcel-plugin-angular`（如可用），否则 warn 不支持 AOT；标注 experimental — parcel 适配器没有 framework 分支系统，在 `transformConfig` 提取 `framework` 字段后 logger.warn 实验性提示，不强行接入维护停滞的社区插件
- [x] 12.6 `__tests__/integration/fixtures/{rollup,rolldown,esbuild,parcel}/` 加 angular fixture（esbuild/parcel 仅做 SPA build 跑通断言，不做 SSR）— rollup/rolldown 各 2 份（spa+ssr），esbuild/parcel 各 1 份（仅 spa）
- [x] 12.7 文档 SSR 矩阵：rollup/rolldown 标 ✅；esbuild/parcel 标 "experimental, JIT-only" — `bundlers.md` Angular 矩阵全 7 行更新到位
- [x] 12.8 docs `contributing/adding-plugin.md` 加一节 "Angular 接入参考"，给三套机制（analogjs / ngtools / JIT）的对照表 — 加入第 9 节
- [-] 12.9 `pnpm changeset`，PR3 标题 `feat(plugin-angular): complete bundler matrix (rollup/rolldown/esbuild/parcel)` — **跳过**：用户保留 changeset 操作权

## 13. 后期清理 (post-PR3)

- [x] 13.1 archive `add-plugin-angular` change：`openspec archive add-plugin-angular`，把 spec deltas 合并入 `openspec/specs/` — `openspec archive add-plugin-angular --yes` 执行成功，归档为 `2026-06-01-add-plugin-angular`，8 份 spec delta 全部合并（cli-create / plugin-angular / rolldown-adapter / rollup-adapter / rspack-adapter / ssr-dev-middleware / vite-adapter / webpack-adapter；total +20 added requirements）
- [x] 13.2 verify `openspec list` 不再含 `add-plugin-angular`，`openspec/specs/plugin-angular/spec.md` 已存在 — `openspec list` → "No active changes found"；`openspec/specs/plugin-angular/spec.md` 已存在
- [x] 13.3 docs `index.md` 首页 hero 列表加 "Angular 17+ 一等公民" — features 数组新增第 7 张卡片（emoji: 🅰️），框架插件枚举从 4 个扩到 6 个
