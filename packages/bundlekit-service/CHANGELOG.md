# @bundlekit/service

## 0.0.8

### Patch Changes

- adbfb8f: feat: 新增 Parcel 2 打包器适配器，修复多项工程问题

  **@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

  **@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"`；`BUNDLER_PACKAGE_MAP` 新增 `parcel → @bundlekit/bundler-parcel`；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 及 `detectAvailablePMs` 的 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式版本不匹配时拦截检测导致 pnpm 被误报未安装；`detectPackageManagerFromLockFile()` 新增从当前目录向上遍历查找锁文件，正确识别 pnpm workspace。

  **@bundlekit/service**：`loadBundlerPlugin` 改为三级解析策略（自然解析 → context 目录解析 → 动态 `import()` 降级），修复 pnpm 安装的 peerDependencies 无法被找到的问题。

  **@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel；`detectAvailablePMs` 补充 `result.error` 检查；CLI rollup external 加入 `@bundlekit/bundler-parcel`。

  **@bundlekit/docs-agent**：修复 wrangler.toml 缺少 `account_id` 导致的 Cloudflare 鉴权错误；简化 CI/CD deploy workflow，改用 wrangler-action 命令行参数方式，移除独立 wrangler.toml。

- Updated dependencies [adbfb8f]
  - @bundlekit/shared-utils@0.0.6
  - @bundlekit/bundler-rolldown@0.0.6
  - @bundlekit/bundler-rollup@0.0.8
  - @bundlekit/bundler-rspack@0.0.6
  - @bundlekit/bundler-vite@0.0.6
  - @bundlekit/bundler-webpack@0.0.6

## 0.0.7

### Patch Changes

- Updated dependencies [09b8001]
  - @bundlekit/shared-utils@0.0.5
  - @bundlekit/bundler-rolldown@0.0.5
  - @bundlekit/bundler-rollup@0.0.7
  - @bundlekit/bundler-rspack@0.0.5
  - @bundlekit/bundler-vite@0.0.5
  - @bundlekit/bundler-webpack@0.0.5

## 0.0.6

### Patch Changes

- Updated dependencies [d6a3baf]
  - @bundlekit/bundler-rollup@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [b8f4151]
- Updated dependencies [9f2f088]
- Updated dependencies [3020202]
  - @bundlekit/shared-utils@0.0.4
  - @bundlekit/bundler-rollup@0.0.5
  - @bundlekit/bundler-rolldown@0.0.4
  - @bundlekit/bundler-rspack@0.0.4
  - @bundlekit/bundler-vite@0.0.4
  - @bundlekit/bundler-webpack@0.0.4

## 0.0.4

### Patch Changes

- Updated dependencies [9f2f088]
  - @bundlekit/bundler-rollup@0.0.4

## 0.0.3

### Patch Changes

- 81752e3: bump all packages to 0.0.3
- Updated dependencies [81752e3]
  - @bundlekit/bundler-rolldown@0.0.3
  - @bundlekit/bundler-webpack@0.0.3
  - @bundlekit/bundler-rollup@0.0.3
  - @bundlekit/bundler-rspack@0.0.3
  - @bundlekit/bundler-vite@0.0.3
  - @bundlekit/shared-utils@0.0.3

## 0.0.2

### Patch Changes

- fix: bump version for npm publish
- Updated dependencies
  - @bundlekit/bundler-rolldown@0.0.2
  - @bundlekit/bundler-rollup@0.0.2
  - @bundlekit/bundler-rspack@0.0.2
  - @bundlekit/bundler-vite@0.0.2
  - @bundlekit/bundler-webpack@0.0.2
  - @bundlekit/shared-utils@0.0.2
