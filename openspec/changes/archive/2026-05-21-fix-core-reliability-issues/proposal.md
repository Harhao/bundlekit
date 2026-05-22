## Why

当前 `bundlekit` 核心链路存在多个影响正确性的 bug（webpack 生产构建不等待完成、`validateConfig` 从未真正执行、plugin apply 拿到过期 config），以及类型系统和工程规范层面的系统性缺失（TypeScript strict 关闭、零测试覆盖、CI 只构建部分包）。这些问题在项目初期影响有限，但随着功能扩展和多 bundler 适配器增加，已累积成为可靠性风险。

## What Changes

- **修复 webpack `prodBuild`**：将回调式 `Webpack(config, cb)` 改为 `Promise` 包裹，确保生产构建真正 await 完成，错误可正确传播
- **修复 `validateConfig` 调用**：在 `run()` 中传入 `buildConfig` 参数，使验证逻辑真正执行
- **修复 `getBundlerRegistry()` 返回类型**：修正类型声明从 `IBuildTools`（字符串联合）改为 `Record<IBuildTools, string>`
- **修复 plugin apply 拿到过期 config**：init 循环中每次 apply 时读取最新的 `this.buildConfig` 而非循环开始时的快照
- **修复 `resolvePaths` 不处理对象 entry**：补充 `Record<string, string>` 和 `string[]` 两种 entry 格式的路径解析
- **修正 `IBuildConfig.config` 类型**：将 `[K in IBuildEnv]` 改为 `Partial<{ [K in IBuildEnv]: ... }>`，移除 `defaultConfig.ts` 中的 `as any` 断言
- **修正 `IBuildOutput.formats` 为数组类型**：`IBuildFormat | IBuildFormat[]`，各 bundler adapter 同步适配
- **启用 TypeScript strict 模式**：在 `tsconfig.base.json` 开启 `strict: true`，修复暴露出的类型错误
- **修复 `validate.ts` null 检查顺序**：将 config null 检查移到第一位
- **补充测试基础设施**：配置 Vitest，为核心模块（ConfigLoader、validateBuildConfig、Service、bundler adapters）添加单元测试
- **修复 CI pipeline**：将 `build:service` 扩展为 `build:all`，覆盖所有包的构建验证
- **修正 `exmaple` 包名拼写**（低优先级，不影响运行）

## Capabilities

### New Capabilities

- `test-infrastructure`: 引入 Vitest 测试框架，覆盖 ConfigLoader、validateBuildConfig、Service、各 bundler adapter 核心路径

### Modified Capabilities

- `service-core`: Service 插件 apply 时序修正、`getBundlerRegistry` 类型修正、`prodBuild` async 语义修正
- `config-loading`: `resolvePaths` 补充对象/数组 entry 解析，`IBuildConfig.config` 改为 Partial
- `webpack-adapter`: `prodBuild` Promise 化，`validateConfig` 正确调用，`IBuildOutput.formats` 数组支持

## Impact

- **`packages/bundlekit-shared-utils/lib/types/cli-service/config.ts`**：`IBuildConfig.config` Partial 化，`IBuildOutput.formats` 改为联合类型
- **`packages/bundlekit-shared-utils/lib/types/cli-service/adapter.ts`**：`IBuildTools` 保持不变
- **`packages/bundlekit-shared-utils/lib/shared/validate.ts`**：null 检查顺序修正
- **`packages/bundlekit-service/lib/Service.ts`**：`getBundlerRegistry` 类型、plugin apply 时序、循环 null 安全
- **`packages/bundlekit-service/lib/config/defaultConfig.ts`**：移除 `as any` 断言
- **`packages/bundlekit-service/lib/ConfigLoader.ts`**：`resolvePaths` 补充多 entry 格式
- **`packages/bundlekit-bundler-webpack/src/index.ts`**：`prodBuild` Promise 化，`validateConfig` 调用修正
- **所有 bundler adapters**：`IBuildOutput.formats` 数组读取适配
- **`tsconfig.base.json`**：`strict: true`
- **`.github/workflows/ci.yml`**：`build:all` 替换 `build:service`
- **新增 `packages/__tests__/`**：Vitest 配置 + 核心单元测试
