## 1. 类型层修复

- [x] 1.1 修改 `IBuildConfig.config` 为 `Partial<{ [K in IBuildEnv]: IEnvBuildConfig }>`，并将 env 配置抽取为 `IEnvBuildConfig` interface（`packages/devkit-shared-utils/lib/types/cli-service/config.ts`）
- [x] 1.2 修改 `IBuildOutput.formats` 类型为 `IBuildFormat | IBuildFormat[]`（同文件）
- [x] 1.3 修改 `IBuildToolAdapter.validateConfig` 签名，增加可选的 `buildConfig?: IBuildConfig` 参数（`packages/devkit-shared-utils/lib/types/cli-service/adapter.ts`）

## 2. ConfigLoader 修复

- [x] 2.1 修复 `validate.ts`：将 `config` 的 null 检查移到第一位，早于 `config?.config?.[mode]` 访问（`packages/devkit-shared-utils/lib/shared/validate.ts`）
- [x] 2.2 修复 `resolvePaths`：补充对 `Array.isArray(entry)` 的逐项 resolve 处理（`packages/devkit-service/lib/ConfigLoader.ts`）
- [x] 2.3 修复 `resolvePaths`：补充对 `typeof entry === "object"` 的 Record 值 resolve 处理（同文件）
- [x] 2.4 更新 `defaultConfig.ts`：移除 `as any as IBuildConfig["config"]` 类型断言，使其与 Partial 类型匹配（`packages/devkit-service/lib/config/defaultConfig.ts`）

## 3. Service 核心修复

- [x] 3.1 修复 `getBundlerRegistry()` 返回类型：从 `IBuildTools` 改为 `Record<IBuildTools, string>`（`packages/devkit-service/lib/Service.ts`）
- [x] 3.2 修复 plugin apply 循环：将 `apply(api, buildConfig)` 改为 `apply(api, this.getBuildConfig())`，确保每个 plugin 拿到最新 config（`packages/devkit-service/lib/Service.ts`）
- [x] 3.3 修复 `Service` 中 nullable 字段的 null 安全访问（`packageManager`、`fileManager`），确保使用前有非 null 断言或检查

## 4. Webpack Adapter 修复

- [x] 4.1 修复 `WebpackBundler`：在构造函数中保存 `IBuildConfig` 引用（新增 `private buildConfig: IBuildConfig`）（`packages/devkit-bundler-webpack/src/index.ts`）
- [x] 4.2 修复 `transformConfig`：保存传入的 `IBuildConfig` 到 `this.buildConfig`（同文件）
- [x] 4.3 修复 `run()`：将 `this.validateConfig(config)` 改为 `this.validateConfig(config, this.buildConfig)`（同文件）
- [x] 4.4 修复 `prodBuild`：用 `new Promise((resolve, reject) => Webpack(config, (err, stats) => {...}))` 包裹，callback 中正确 resolve/reject（同文件）
- [x] 4.5 修复 `prodBuild`：将 `stats.toString(...)` 的打印移入 Promise，并在 `stats.hasErrors()` 时 reject（同文件）
- [x] 4.6 适配 `IBuildOutput.formats` 数组类型：在 TransformConfig 中读取 formats 时使用 `Array.isArray(formats) ? formats[0] : formats`（`packages/devkit-bundler-webpack/src/transformConfig.ts`）

## 5. 其他 Bundler Adapters formats 适配

- [x] 5.1 检查并更新 `devkit-bundler-vite` 中 formats 读取逻辑，兼容数组类型
- [x] 5.2 检查并更新 `devkit-bundler-rollup` 中 formats 读取逻辑，兼容数组类型
- [x] 5.3 检查并更新 `devkit-bundler-rspack` 中 formats 读取逻辑，兼容数组类型
- [x] 5.4 检查并更新 `devkit-bundler-rolldown` 中 formats 读取逻辑，兼容数组类型

## 6. TypeScript Strict 模式

- [x] 6.1 在 `tsconfig.base.json` 中将 `strict: false` 改为 `strict: true`
- [x] 6.2 运行 `pnpm build:shared` 修复 `shared-utils` 暴露的类型错误
- [x] 6.3 运行 `pnpm build:service` 修复 `devkit-service` 暴露的类型错误
- [x] 6.4 运行 `pnpm build:webpack` 修复 `bundler-webpack` 暴露的类型错误
- [x] 6.5 运行 `pnpm build:all` 修复所有剩余包的类型错误，用 `@ts-expect-error` 标注无法立即修复的项并注明原因

## 7. 测试基础设施

- [x] 7.1 在根目录 `package.json` 添加 `vitest` 为 devDependency，添加 `test` script：`vitest run`
- [x] 7.2 在根目录创建 `vitest.config.ts`，配置 TypeScript 解析和 alias
- [x] 7.3 在 `pnpm-workspace.yaml` 中移除 `packages/__tests__` 的排除规则，创建 `packages/__tests__/` 目录和其 `package.json`
- [x] 7.4 编写 `__tests__/validate.test.ts`：覆盖 `validateBuildConfig` 全部分支（valid/missing entry/missing output/null config）
- [x] 7.5 编写 `__tests__/configLoader.test.ts`：覆盖 `resolvePaths` string/array/object entry 三种格式，以及 no-config-file throw
- [x] 7.6 编写 `__tests__/service.test.ts`：覆盖 plugin apply 时序（plugin A 修改 config，plugin B 拿到新值）和 `getBundlerRegistry` 返回类型
- [x] 7.7 运行 `pnpm test` 确认所有测试通过

## 8. CI Pipeline 修复

- [x] 8.1 修改 `.github/workflows/ci.yml`：将 `pnpm build:service` 改为 `pnpm build:all`
- [x] 8.2 在 `ci.yml` 中在 build 步骤后增加 `pnpm test` 步骤

## 9. 验证

- [x] 9.1 运行 `pnpm build:all` 确认全量构建通过，无类型错误
- [x] 9.2 运行 `pnpm test` 确认所有单元测试通过
- [ ] 9.3 在 `packages/exmaple` 中运行 `npm run webpack:dev` 和 `npm run vite:dev` 验证运行时无回归（需手动执行）
