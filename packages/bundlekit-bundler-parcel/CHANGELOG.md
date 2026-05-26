# @bundlekit/bundler-parcel

## 0.0.3

### Patch Changes

- a031ba5: feat: 新增 Parcel 2 / esbuild 打包器适配器，修复多项工程问题

  **@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

  **@bundlekit/bundler-esbuild**（新包）：基于 esbuild Go 实现，极速编译。支持 TypeScript/JSX/TSX/CSS/CSS Modules 原生处理、watch + DevServer、Library 模式、Code splitting（ESM）及 dev SSR middleware（`outExtension: {".js": ".cjs"}` + onEnd plugin 动态获取产物路径）。

  **@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"` / `"esbuild"`；`BUNDLER_PACKAGE_MAP` 对应新增两条映射；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 及 `detectAvailablePMs` 的 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式版本不匹配时拦截检测导致 pnpm 被误报未安装；`detectPackageManagerFromLockFile()` 新增从当前目录向上遍历查找锁文件，正确识别 pnpm workspace。

  **@bundlekit/service**：`loadBundlerPlugin` 改为三级解析策略（自然解析 → context 目录解析 → 动态 `import()` 降级），修复 pnpm 安装的 peerDependencies 无法被找到的问题。

  **@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel / esbuild；`detectAvailablePMs` 补充 `result.error` 检查；CLI rollup external 加入两个新 bundler 包。

  **@bundlekit/docs-agent**：修复 wrangler.toml 缺少 `account_id` 导致的 Cloudflare 鉴权错误；简化 CI/CD deploy workflow，移除独立 wrangler.toml。

- Updated dependencies [a031ba5]
  - @bundlekit/shared-utils@0.0.7

## 0.0.2

### Patch Changes

- adbfb8f: feat: 新增 Parcel 2 打包器适配器，修复多项工程问题

  **@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

  **@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"`；`BUNDLER_PACKAGE_MAP` 新增 `parcel → @bundlekit/bundler-parcel`；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 及 `detectAvailablePMs` 的 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式版本不匹配时拦截检测导致 pnpm 被误报未安装；`detectPackageManagerFromLockFile()` 新增从当前目录向上遍历查找锁文件，正确识别 pnpm workspace。

  **@bundlekit/service**：`loadBundlerPlugin` 改为三级解析策略（自然解析 → context 目录解析 → 动态 `import()` 降级），修复 pnpm 安装的 peerDependencies 无法被找到的问题。

  **@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel；`detectAvailablePMs` 补充 `result.error` 检查；CLI rollup external 加入 `@bundlekit/bundler-parcel`。

  **@bundlekit/docs-agent**：修复 wrangler.toml 缺少 `account_id` 导致的 Cloudflare 鉴权错误；简化 CI/CD deploy workflow，改用 wrangler-action 命令行参数方式，移除独立 wrangler.toml。

- Updated dependencies [adbfb8f]
  - @bundlekit/shared-utils@0.0.6
