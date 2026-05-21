## Context

`bundle-devkit` 是一个多 bundler 前端构建工具包，核心链路为：CLI → Service（插件系统 + 配置加载）→ bundler adapter（webpack/vite/rollup/rspack/rolldown）。当前代码库存在多个影响运行时正确性的 bug 和类型系统缺口，具体背景见 proposal.md。

本设计文档涵盖跨多个模块的修复策略、测试基础设施引入以及 TypeScript strict 模式迁移方案。

## Goals / Non-Goals

**Goals:**

- 修复 webpack `prodBuild` 不等待完成、错误不传播的 async 语义 bug
- 修复 `validateConfig` 从未真正执行的逻辑 bug
- 修正 `getBundlerRegistry` 返回类型与实际不匹配的类型 bug
- 修复 plugin apply 循环使用过期 config 快照的状态 bug
- 修正 `resolvePaths` 不处理对象/数组 entry 的路径解析缺失
- 将 `IBuildConfig.config` 从必填全部 env 改为 Partial，消除 `as any` 断言
- 扩展 `IBuildOutput.formats` 支持数组，各 adapter 同步适配
- 开启 TypeScript `strict: true` 并修复暴露的类型错误
- 建立 Vitest 测试框架，覆盖核心路径单元测试
- 修复 CI pipeline 覆盖范围

**Non-Goals:**

- 重构 plugin 生命周期（beforeBuild/afterBuild hooks 等扩展功能）
- 添加 bundler 间特性对等检查
- 重写 deepMerge 数组合并策略
- 修改 `exmaple` 包名（需协调 changelog，单独处理）
- 引入 E2E 测试

## Decisions

### D1: webpack prodBuild 改为 Promise 包裹

**当前问题**：`Webpack(config, callback)` 是回调式 API，包在 `async` 函数中不会真正 await，错误也无法传播到 `try/catch`。

**决策**：用 `new Promise((resolve, reject) => Webpack(config, (err, stats) => { ... }))` 包裹，在回调中判断 err 和 stats.hasErrors() 后 resolve/reject。

**Alternative considered**：改用 webpack 的 `compiler.run()` Promise 版 — 但 webpack 5 官方推荐的 async 路径是直接包 Promise，保持 API surface 不变。

---

### D2: validateConfig 调用修正

**当前问题**：`run()` 只传了 webpack 原生 config，未传 `buildConfig`，导致验证 fallback 到 `return true`。

**决策**：在 `WebpackBundler.run()` 中改为 `this.validateConfig(config, this._buildConfig)`，并在构造函数中保存 `IService` 引用（或直接保存 `buildConfig`）。同时对其他 adapter 统一检查 validateConfig 调用方式。

---

### D3: plugin apply 使用最新 buildConfig

**当前问题**：`init()` 循环里 `apply(api, buildConfig)` 的第二个参数是循环开始前捕获的局部变量，不反映中途 `setBuildConfig` 的修改。

**决策**：将 apply 第二个参数改为 `this.getBuildConfig()`（每次从 service 读取最新值），同时将 `modifyBuildConfig` 改为支持传入修改函数（`(prev: IBuildConfig) => IBuildConfig`）以保证原子性。

**Alternative considered**：改用事件系统（Tapable）— 过度设计，当前插件数量有限，简单改取值来源即可。

---

### D4: IBuildConfig.config 改为 Partial

**当前问题**：`[K in IBuildEnv]: {...}` 要求 5 个环境全部定义，defaultConfig.ts 用 `as any` 绕过。

**决策**：改为 `Partial<{ [K in IBuildEnv]: IEnvBuildConfig }>` 并抽取 `IEnvBuildConfig` 为独立 interface，ConfigLoader 的 `resolvePaths` 遍历实际存在的 key，运行时访问增加 fallback 到 `development`（已有此逻辑，保持不变）。

---

### D5: TypeScript strict 模式迁移策略

**当前风险**：直接开启 `strict: true` 会在全 monorepo 产生大量类型错误，无法一次性修完。

**决策**：分阶段处理：
1. 先修复本次 change 涉及的几个文件中 strict 引起的错误（nullable 字段、隐式 any 等）
2. 在根 `tsconfig.base.json` 开启 `strict: true`
3. 未涉及文件如有残余错误，用 `// @ts-expect-error` 临时标注并创建 follow-up issue（注释说明原因）

**Alternative considered**：单独给每个 package 的 tsconfig 单独加 strict — 过于分散，维护成本高。

---

### D6: 测试框架选型

**决策**：选用 **Vitest**，理由：
- 原生支持 ES 模块（项目 `module: esnext`，jest 对 ESM 支持复杂）
- 与 Vite 生态一致（项目已依赖 Vite）
- 配置简洁，与现有 TypeScript 配置兼容
- 支持 `vi.mock` 对 bundler 进行 mock

**测试放置位置**：在 monorepo 根新建 `packages/__tests__/` 目录（pnpm workspace 已有此路径的排除规则，先移除排除规则让 workspace 识别，或作为独立的 vitest 项目运行）。

实际执行：将测试放在根目录 `__tests__/` 下，vitest 配置在根 `package.json` 的 `test` script，`vitest.config.ts` 放根目录。

---

### D7: resolvePaths 多 entry 格式支持

**决策**：在 `typeof entry === "string"` 分支后，补充：
- `Array.isArray(entry)`: 对每个元素做 `resolveDir`
- `typeof entry === "object"`: 对每个值做 `resolveDir`

## Risks / Trade-offs

- **[Risk] strict 模式迁移可能暴露未预期的类型错误** → 逐文件修复，残余用 `@ts-expect-error` 标注，不阻塞本次 change
- **[Risk] formats 从单值改为联合类型是 breaking change** → 各 adapter 在读取时使用 `Array.isArray(formats) ? formats : [formats]` 兼容旧值；defaultConfig 保持单值不变
- **[Risk] plugin apply 改为读最新 config 后，plugin 间顺序依赖更明显** → 现有 plugin 数量少，风险可控；在 design 文档中记录此行为变化

## Migration Plan

所有修改均向后兼容（用户的 `.devkitrc.ts` 无需改动），按以下顺序执行：

1. 修复类型层（shared-utils/types）
2. 修复 ConfigLoader（resolvePaths + defaultConfig）
3. 修复 Service（plugin apply + getBundlerRegistry）
4. 修复 bundler adapters（prodBuild + validateConfig + formats）
5. 开启 strict 模式并修复暴露错误
6. 建立测试基础设施并写测试
7. 修复 CI pipeline

每步修改后确保 `pnpm build:all` 通过，再进行下一步。

## Open Questions

- `modifyBuildConfig` 改为接受函数参数是否影响现有插件（plugin-react/vue/mock）？→ 需要检查这 3 个 plugin 的调用方式（当前都是直接赋值整个 config，需确认）
