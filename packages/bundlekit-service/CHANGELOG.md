# @bundlekit/service

## 0.0.8

### Patch Changes

- a19cb50: fix: 修复 loadBundlerPlugin 模块解析失败及 pnpm 工作区包管理器误识别问题

  **@bundlekit/service**：`loadBundlerPlugin` 原来通过 `require.resolve(name, { paths: [context/node_modules, ...] })` 查找打包工具插件，该 `paths` 参数会完全覆盖默认解析路径，导致 pnpm 安装在 `bundlekit-service/node_modules/` 里的 peerDependencies 永远无法被找到。修复后改为三级解析策略：① 自然解析（从 service 自身目录出发，优先命中 peerDependencies）→ ② 从项目 context 目录解析（兼容用户项目自行安装的场景）→ ③ 动态 `import()` 降级。

  **@bundlekit/shared-utils**：`PackageManager` 构造函数仅在 `context` 目录本身查找锁文件，pnpm monorepo 中各子包目录没有独立锁文件，导致检测失败后回退到 `hasYarnCommand()` 全局判断，在安装了 yarn 的机器上误用 `yarn add` 代替 `pnpm add`。修复后新增 `detectPackageManagerFromLockFile()` 方法，从当前目录向上遍历查找 `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`，正确识别 pnpm workspace。

- Updated dependencies [a19cb50]
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
