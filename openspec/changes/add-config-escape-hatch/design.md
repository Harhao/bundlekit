## Context

**当前扩展点**

```
.devkitrc.ts            ConfigLoader.resolveAllConfig()
   │                            │
   └─ IBuildConfig ◄────────────┘
        │
        ▼
   plugin.apply(api, buildConfig)         ← 插件层（写 framework 等字段）
        │
        ▼
   adapter.transformConfig(buildConfig)   ← bundler 内部转原生 config
        │
        ▼
   service.configureConfig(rawConfig)     ← 当前的 changeConfigure 钩子
        │
        ▼
   adapter.run(rawConfig)
```

只有 `changeConfigure` 一处可改原生配置，且无 bundler 上下文 / 类型不友好。

**约束**

- `@devkit/shared-utils` 不能在运行时 deps 里引入 webpack/vite/rspack/rollup/rolldown（包体积、与 change 1 的方向冲突）。
- 用户期望写 `tools.webpack(config) => { ... }` 时 IDE 自动补全。
- 调用顺序对插件生态可能影响很大（plugins / changeConfigure / tools 三者）。

## Goals / Non-Goals

**Goals**

- 提供分 bundler 的逃生舱钩子；类型精确（IDE 友好）。
- 调用时机明确：`transformConfig → tools[bundler] → changeConfigure → run`。
- 不引入 helpers（addPlugin / addRule）也能完成日常任务；helpers 留作 future enhancement。
- shared-utils 不在运行时依赖任何 bundler，纯类型层引用。

**Non-Goals**

- 不实现 chain 风格 API（webpack-chain）。
- 不重构 `changeConfigure`（与 change 1 类似，保持向后兼容）。
- 不为 rolldown 单独创建 spec（暂归入 `config-escape-hatch` capability）。

## Decisions

### D1：tools 字段放在 IBuildConfig 顶层 vs envConfig 内

**放顶层**。理由：

- 与 `changeConfigure` 同级，语义对齐
- 多环境（development / production）通常想用同一段 hook，写在顶层避免重复
- 用户如需按 mode 分支，可在 hook 内 `if (ctx.mode === 'production')`

```ts
const config: IBuildConfig = {
  bundler: 'webpack',
  tools: {
    webpack(config, { mode, command, env }) {
      if (mode === 'production') config.devtool = false;
    },
    vite: (cfg) => { cfg.optimizeDeps?.include?.push('lodash-es'); }
  },
  config: { /* ... */ }
}
```

### D2：返回值语义 — mutate vs return new

**两者都允许**。Hook 签名 `(config, ctx) => void | Config`：
- 返回 `undefined`（包括 mutate 后）→ 用 mutated config
- 返回新对象 → 用新对象（service 进行赋值替换）

业界 Rsbuild、umi 都是这种双形态，方便不同写法的用户。

### D3：ToolsCtx 字段范围

```ts
interface ToolsCtx {
  mode: IBuildEnv;            // development | production | ...
  command: 'serve' | 'build'; // 当前命令
  env: 'client' | 'server';   // SSR 区分（change 3 用，本 change 默认 'client'）
  bundler: IBundlerName;      // 冗余信息（hook 内已通过键名知道）
}
```

`env` 字段在 change 3 之前默认 `'client'`，预留语义。`bundler` 看似冗余但有用：用户可在外部公共 hook 中复用一段函数。

### D4：调用顺序

```
       transformConfig(buildConfig)
              │
              ▼  rawConfig
       ┌───────────────────────────┐
       │ tools[bundlerName]?.(...) │   ← 先精准 hook
       └──────────┬────────────────┘
                  ▼
       ┌───────────────────────────┐
       │ changeConfigure(...)      │   ← 再全局兜底
       └──────────┬────────────────┘
                  ▼
              run(rawConfig)
```

理由：tools 是精准粒度的扩展点，应先于 changeConfigure 的全局修改 — 让 changeConfigure 能在 tools 之上做最后的整体调整。

### D5：类型层如何不引入运行时依赖

shared-utils 用三种手段：

1. `import type { Configuration } from 'webpack'` — 仅类型，不会被运行时 require。
2. webpack/vite/rspack/rollup/rolldown 在 shared-utils 的 `peerDependencies` 中标注 `optional: true`（与各自 `@devkit/bundler-*` 一致）。
3. 提供 fallback 类型 `type WebpackConfig = unknown` 当 webpack 没装，但通过 `declare module` + 条件 import 让有装的用户拿到精确类型。

实现层面更简单的做法：
- shared-utils 直接 `import type * as Webpack from 'webpack'`，发布到 npm 后 npm/pnpm 不会因为缺少 webpack 而报错（types 不存在时 TS 会回退到 any）。配 `tsconfig` 中 `skipLibCheck: true` 即可。

### D6：service 如何把 hook 注入到 adapter

两个方案：

| 方案 | 说明 | 评价 |
|---|---|---|
| **A. service 在 transformConfig 之后调用** | 不改 IBuildToolAdapter 接口，bundler 不感知 hook | ✅ 选用 |
| B. 在 IBuildToolAdapter 上加 `applyTools(config, hook)` 方法 | 各 bundler 自己负责调用 | 重复逻辑，增加心智负担 |

伪代码（Service.startBuilder 内）：

```ts
const builder = new bundlerPlugin(this, this.mode);
const rawConfig = await builder.transformConfig(buildConfig);
const afterTools = await applyTools(buildConfig, finalBundler, rawConfig, ctx);
const finalConfig = await this.configureConfig(afterTools);
await builder.run(finalConfig);
```

`applyTools` 工具放在 service 自己 `lib/utils/applyTools.ts`，做异步 / 同步 / void / object 的兼容处理。

### D7：错误处理

hook 抛错不吞掉 — 直接冒泡到 service 顶层错误处理（`startBuildService` 的 try/catch），用 logger.error 输出。理由：用户写错了应当立即知道，不应静默使用未变更的 config。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 类型联动（webpack 版本升级 → shared-utils 类型变化）可能导致用户类型错误 | shared-utils 中的 webpack 类型仅作 alias，用户实际类型仍来自其本地 webpack 版本（peerDeps 模型）|
| Hook 中误改不可序列化字段（如 functions、Symbol）导致后续插件报错 | 文档中明确 hook 调用顺序，提示最后一步可用 changeConfigure 兜底 |
| 旧 `changeConfigure` 用户混用 tools，行为预期不一致 | docs 中明确"tools 先执行，changeConfigure 后执行" |
| TypeScript 强类型的 hook 与 mutate 返回 void 在某些 IDE 推断不友好 | 在类型声明中用 union `void | Config`；提供例子让用户更倾向 mutate |

## Migration Plan

1. shared-utils 加 `tools` 字段类型 → service 加 `applyTools` 调用 → 两处不破坏现有用户。
2. 文档（最终在 change 5 整理）增加 tools 用例表格。
3. 任何旧 `changeConfigure` 用法继续工作；后续小版本 release notes 推荐迁移到 tools。

## Open Questions

- 是否需要给 hook 传一个 `helpers` 参数？例如 `addPlugin(plugin)` 这种。第一版**不做**，等用户反馈再说。
- 多个 hook 函数（数组形态）是否支持？`tools.webpack: [hookA, hookB]` — 第一版**不做**，单个函数足够。
- hook 是否能阻断 build？暂不提供，hook 抛异常即可。
