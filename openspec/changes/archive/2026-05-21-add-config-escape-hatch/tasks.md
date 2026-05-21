## 1. shared-utils 类型层

- [x] 1.1 在 `packages/devkit-shared-utils/lib/types/cli-service/config.ts` 新增 `ToolsCtx` 接口（`mode / command / env / bundler`）
- [x] 1.2 新增 `IBundlerConfigMap` 类型映射（webpack→Configuration, vite→InlineConfig, rspack→RspackOptions, rollup→RollupOptions, rolldown→RolldownConfig），全部使用 `import type`
- [x] 1.3 在 `IBuildConfig` 上新增可选 `tools?: { [K in IBundlerName]?: (config: IBundlerConfigMap[K], ctx: ToolsCtx) => void | IBundlerConfigMap[K] | Promise<void | IBundlerConfigMap[K]> }`
- [x] 1.4 在 `tsconfig.json` 中确保 `skipLibCheck: true`，避免缺失 bundler 包时报错
- [x] 1.5 单测：`.devkitrc.ts` 类型断言 fixture，覆盖 5 个 bundler 钩子的类型推断

## 2. service: 注入 hook

- [x] 2.1 新增 `packages/devkit-service/lib/utils/applyTools.ts`：导出 `applyTools(buildConfig, bundlerName, rawConfig, ctx): Promise<unknown>`，处理同步/异步、void/return 两种返回形态
- [x] 2.2 在 `Service.startBuilder` 中：拿到 `bundlerPlugin` 实例后，先 `transformConfig`，再调 `applyTools`，再 `configureConfig`，最后 `run`
- [x] 2.3 构建 `ToolsCtx`：`mode = this.mode`，`command = this.commands` 中匹配的当前命令名，`env = 'client'`（SSR 由 change 3 重写时改），`bundler = finalBundler`
- [x] 2.4 hook 抛错时记录日志并 rethrow（不 swallow）

## 3. 各 bundler adapter 配合（最小改动）

- [x] 3.1 验证 webpack adapter：transform 完成的配置允许被 service 改动后再 run
- [x] 3.2 同上 vite adapter
- [x] 3.3 同上 rspack adapter
- [x] 3.4 同上 rollup adapter
- [x] 3.5 同上 rolldown adapter
- [x] 3.6 注：本 change 不在 bundler 内部直接调 hook（D6 决策选 A）；上述步骤主要是回归验证，确保 service 改动不破坏 bundler

## 4. 文档（最小补丁）

- [x] 4.1 在 `packages/devkit-docs/docs/guide/config.md` 新增"逃生舱（tools）"章节，给出 5 个 bundler 的最小用例
- [x] 4.2 标注调用顺序：plugins → transform → tools → changeConfigure → run
- [x] 4.3 备注：若 bundler 未安装，对应 `tools.<name>` 类型会回退到 `any`，运行时 hook 永远不会被调用

## 5. 测试

- [x] 5.1 在 `__tests__` 下新增 `tools-hook.test.ts`：mock 一个 fake bundler adapter，验证调用顺序、mutation/return 双形态、错误传播
- [x] 5.2 在 example 项目中加一个 `.devkitrc.ts` 用例，包含 `tools.webpack`，运行 build 验证 plugin 被注入
- [x] 5.3 修复 `Service.run` 中 `command` 字段未持久化为 ctx 的问题（如有）

## 6. 协同

- [x] 6.1 与 Change 3 (`add-ssr-support`) 对齐 `ToolsCtx.env` 字段语义；本 change 默认 'client'，SSR 落地后由 service 在 server pass 中传 'server'
- [x] 6.2 与 Change 1 (`refactor-bundler-deps`) 对齐：shared-utils 类型层使用 `import type` + `peerDependenciesMeta.optional`，与 service 的依赖瘦身策略一致
