## Why

bundlekit 当前提供了 React、Vue 3、Node 三套框架插件，覆盖了主流前端生态的两端（React/Vue），但**缺少对 Angular 的支持**。Angular 是企业级前端的重要选项，社区与企业用户在使用 bundlekit 时只能自行接 `tools.<bundler>` 逃生舱手写 Angular 编译链路，体验远不及 `bc create my-app -t react-ts -b vite --ssr` 一行起项目的同等水平。本次新增 `@bundlekit/plugin-angular`，把 Angular 17+ 的 standalone + SSR 形态以一等公民的方式纳入 bundlekit 的"框架插件 + 多 bundler 适配"体系。

## What Changes

- 新增 `@bundlekit/plugin-angular` 包：导出 `apply` hook 写入 `framework: "angular"`，提供 `template-angular-ts` 与 `template-angular-js` 两套项目模板（SPA / SSR / MPA / library 形态对齐 React 模板）。
- **BREAKING**（仅类型层）：`IBuildFramework` 联合类型从 `"react" | "vue3"` 扩展为 `"react" | "vue3" | "angular"`；下游消费者若用穷举 switch 需补分支。
- 7 个 bundler 适配器（vite / webpack / rspack / rollup / rolldown / esbuild / parcel）各自新增 `framework === "angular"` 处理分支，注入对应生态的 Angular 编译插件 / loader / SWC 装饰器开关；esbuild 与 parcel 第一版标注为实验性（JIT-only）。
- CLI 注册：`bundlekit-cli` 的 `resolvePluginPkgName` / `normalizeTemplate` / `CreateApp.tsx TEMPLATES` / `add` 命令的 `PLUGIN_MAP` 都加入 angular 入口；CLI MCP 模板列表同步更新。
- 文档更新：`guide.md` / `bundlers.md`（SSR 支持矩阵新增 angular 行）/ `ssr.md`（新增 Angular SSR `renderApplication` 章节）/ `cli.md` / `cli-mcp.md` 同步。
- 集成测试 fixture：`__tests__/integration/fixtures/<bundler>/.bundlekitrc.spa.ts`、`.ssr.ts` 增加 angular 场景；第一阶段先覆盖 vite，第二阶段补 webpack/rspack，第三阶段补剩余 4 个 bundler。
- 分 3 个 PR 渐进交付（PR1 vite + 包骨架 + CLI 注册；PR2 webpack/rspack；PR3 rollup/rolldown/esbuild/parcel）。

## Capabilities

### New Capabilities
- `plugin-angular`: Angular 框架插件包，提供 `apply` hook 写入 `framework="angular"`、generator hook 处理依赖追加，以及 `template-angular-ts` / `template-angular-js` 两套基于 Angular 17+ standalone 的项目模板（覆盖 SPA、SSR、MPA、library 形态）。

### Modified Capabilities
- `vite-adapter`: 新增 `framework === "angular"` 分支，dynamic import `@analogjs/vite-plugin-angular`，client / server / dev SSR middleware 三场景都需覆盖。
- `webpack-adapter`: 新增 `framework === "angular"` 分支，注入 `@ngtools/webpack` 的 `AngularWebpackPlugin` 并替换 ts-loader 的 script rule 处理装饰器/AOT/template。
- `rspack-adapter`: 新增 `framework === "angular"` 分支，开启 SWC 装饰器+装饰器元数据，复用兼容的 webpack Angular plugin。
- `rollup-adapter`: 新增 `framework === "angular"` 分支，dynamic import `@analogjs/vite-plugin-angular`（rollup-API 兼容）。
- `rolldown-adapter`: 镜像 rollup-adapter 的 angular 分支处理。
- `cli-create`: `bc create -t angular-ts` / `-t angular-js` 端到端可用；模板列表与短名 alias 同步扩展。
- `ssr-dev-middleware`: 明确所有 bundler 的 dev SSR middleware 在调用 `entry-server.render(url)` 时 `await` 返回值（兼容 sync string 与 Promise<string>），以承接 Angular `renderApplication` 的异步签名。

> 注：esbuild / parcel 在 PR3 标注为实验性（JIT-only），不单独建 spec delta；`cli-generator` / `ssr-build` / `plugin-react` / `plugin-vue` 的 spec 不变（CSR 入口名 `main.ts` 已被 generator 跳过列表覆盖；ssr-build 现有 `string | Promise<string>` 契约已涵盖异步 render）。

## Impact

- **新增包**：`packages/bundlekit-plugin-angular/`（含 `index.ts`、`generator/`、`templates/template-angular-ts/`、`templates/template-angular-js/`）。
- **类型扩展**：`packages/bundlekit-shared-utils/lib/types/cli-service/config.ts:4` 的 `IBuildFramework` 联合类型；任何下游消费此类型并做穷举的代码需补 angular 分支。
- **bundler 适配器** 7 个（`packages/bundlekit-bundler-{vite,webpack,rspack,rollup,rolldown,esbuild,parcel}/src/index.ts` 等）：新增框架分支、装饰器/AOT 处理、HTML/inline template loader（如必要）。
- **CLI**：`packages/bundlekit-cli/lib/commands/create/actions.ts`、`packages/bundlekit-cli/lib/commands/add/index.ts`、`packages/bundlekit-cli/lib/ui/CreateApp.tsx`。
- **CLI MCP**：`packages/bundlekit-cli-mcp/`（如有模板枚举），保持与 cli `TEMPLATES` 同步。
- **共享工具**：`packages/bundlekit-shared-utils/lib/shared/ssrView.ts` 与 `createSSRRequestHandler` 若不支持 async render，需要小改造（改造点不破坏 React/Vue 现有同步 render 行为）。
- **依赖**：模板 `package.json.ejs` 锁 `@angular/core@^17`、`@angular/platform-browser@^17`、`@angular/platform-server@^17`（SSR 时）、`zone.js@~0.14`；bundler 各自的 Angular 适配 plugin 通过 `peerDependencies` 或动态 import 软依赖方式接入，避免成为强制依赖。
- **文档**：`packages/bundlekit-docs/docs/{guide.md,guide/bundlers.md,guide/ssr.md,guide/cli.md,guide/cli-mcp.md}`；新增 `docs/contributing/adding-plugin.md` 中 angular 案例可选补充。
- **测试**：`__tests__/integration/fixtures/<bundler>/` 新增 angular fixture；`__tests__/integration/dev-spa`、`dev-ssr`、`build` 用例补充 angular 跑通断言。
- **changeset**：minor 升级，影响 `@bundlekit/plugin-angular` (new) / `@bundlekit/shared-utils` / 7 个 `@bundlekit/bundler-*` / `@bundlekit/cli` / `@bundlekit/cli-mcp`。
- **不影响**：`@bundlekit/plugin-react` / `@bundlekit/plugin-vue` / `@bundlekit/plugin-node` / `@bundlekit/plugin-mock` / `@bundlekit/request` / `@bundlekit/service` 内核。
