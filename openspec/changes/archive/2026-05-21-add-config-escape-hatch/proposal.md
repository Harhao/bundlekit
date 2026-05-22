## Why

当某个 `@bundlekit/bundler-*` 适配器没有实现用户需要的能力（缺某个 plugin、某种 loader、某个 webpack 性能选项等），用户当前唯一的扩展点是顶层的 `changeConfigure(config, mode)` 全局钩子（`Service.ts:180-187`）。但它有两个体感问题：
1. 钩子接受的 `config` 是泛型 `Record<string, unknown>`，类型完全丢失，用户要靠 `if (config.module)` 这种猜法判断当前是哪个 bundler；
2. 颗粒度过粗，想要"在某个时机注入 plugin/loader/rule"必须自己 mutate 整段配置，缺少分块 + 类型化的扩展面。

业界（Rsbuild / Modern.js / Vue CLI）普遍采用**按 bundler 分块的 tools 钩子**：每个 bundler 有自己的 hook，参数类型精确，可同时返回新对象或直接 mutate。本 change 引入这套 API 作为正式逃生舱。

## What Changes

- 在 `IBuildConfig` 上新增 `tools` 字段（顶层、与 `changeConfigure` 同级）：
  ```ts
  tools?: {
    webpack?:  (config: WebpackConfig,  ctx: ToolsCtx) => void | WebpackConfig;
    vite?:     (config: ViteConfig,     ctx: ToolsCtx) => void | ViteConfig;
    rspack?:   (config: RspackConfig,   ctx: ToolsCtx) => void | RspackConfig;
    rollup?:   (config: RollupOptions,  ctx: ToolsCtx) => void | RollupOptions;
    rolldown?: (config: RolldownConfig, ctx: ToolsCtx) => void | RolldownConfig;
  }
  ```
- `ToolsCtx` 包含 `{ mode, command, env }`（其中 `env: 'client' | 'server'` 为 SSR 改造预留，change 3 落地时填充）。
- 在每个 `@bundlekit/bundler-*` 适配器的 `transformConfig` 完成后、`run` 之前调用对应的 `tools[bundler]?.(config, ctx)`。
- `changeConfigure` 保持不变作为全局兜底钩子，调用顺序为：`tools[bundler]` → `changeConfigure`。
- 配置类型 `Configuration / InlineConfig / RspackOptions / RollupOptions / RolldownOptions` 由各适配器从其上游包重新导出，shared-utils 只负责 `tools` 字段的形状声明（用泛型 + 条件类型映射）。

## Capabilities

### New Capabilities
- `config-escape-hatch`: 分 bundler 的逃生舱钩子语义、调用时机、与 `changeConfigure` 的执行顺序、env 上下文。

### Modified Capabilities
- `webpack-adapter`：`transformConfig` 后增加调用 `tools.webpack` 的步骤
- `vite-adapter`：同上 (`tools.vite`)
- `rspack-adapter`：同上 (`tools.rspack`)
- `rollup-adapter`：同上 (`tools.rollup`)
- 注：rolldown 适配器目前没有独立 capability spec（待后续补齐），先在 `config-escape-hatch` 中囊括其行为。

## Impact

**代码变更**
- `packages/bundlekit-shared-utils/lib/types/cli-service/config.ts`：新增 `tools` 字段类型 + `ToolsCtx`
- `packages/bundlekit-shared-utils/lib/types/cli-service/adapter.ts`：扩展 `IBuildToolAdapter` 接口（可选）暴露当前 bundler 名，让 service 选择 hook
- `packages/bundlekit-service/lib/Service.ts`：`startBuilder` 在 `transformConfig` 与 `configureConfig` 之间插入 `applyTools(buildConfig, bundlerName, config)`
- 每个 `packages/bundlekit-bundler-*/src/index.ts`：在 transform 后回调 service 注入的 hook（推荐通过 service 在 startBuilder 内统一调用，bundler 适配器无需感知）

**API**
- 新公共 API：`tools.{bundler}` — 类型精确化暴露给用户
- 现有 `changeConfigure` 完全向后兼容

**风险**
- TypeScript 类型映射（不同 bundler config 类型不同）会让 `IBuildConfig` 的类型签名变复杂；为保证用户写 `.bundlekitrc.ts` 时 IDE 推断正确，需在 shared-utils 中重新导出各 bundler 的 config 类型，间接引入对各 bundler 包的类型依赖（不是运行时依赖）。
- 若 change 1 已落地，shared-utils 也不应在 deps 中引入 bundler 包；可使用 `import type` + `peerDependencies`/`peerDependenciesMeta.optional` 的方式。
