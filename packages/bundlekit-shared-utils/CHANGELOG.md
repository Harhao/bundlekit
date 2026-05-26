# @bundlekit/shared-utils

## 0.0.6

### Patch Changes

- adbfb8f: feat: 新增 Parcel 2 打包器适配器，修复 pnpm 检测误判

  **@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

  **@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"`；`BUNDLER_PACKAGE_MAP` 新增 `parcel → @bundlekit/bundler-parcel`；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 两处 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式在版本不匹配时拦截检测命令、导致 pnpm 被误报为未安装。

  **@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel；`detectAvailablePMs` 同步修复 `COREPACK_ENABLE_STRICT: '0'`，并补充 `result.error` 检查；CLI rollup external 加入 `@bundlekit/bundler-parcel`。

- a19cb50: fix: 修复 loadBundlerPlugin 模块解析失败及 pnpm 工作区包管理器误识别问题

  **@bundlekit/service**：`loadBundlerPlugin` 原来通过 `require.resolve(name, { paths: [context/node_modules, ...] })` 查找打包工具插件，该 `paths` 参数会完全覆盖默认解析路径，导致 pnpm 安装在 `bundlekit-service/node_modules/` 里的 peerDependencies 永远无法被找到。修复后改为三级解析策略：① 自然解析（从 service 自身目录出发，优先命中 peerDependencies）→ ② 从项目 context 目录解析（兼容用户项目自行安装的场景）→ ③ 动态 `import()` 降级。

  **@bundlekit/shared-utils**：`PackageManager` 构造函数仅在 `context` 目录本身查找锁文件，pnpm monorepo 中各子包目录没有独立锁文件，导致检测失败后回退到 `hasYarnCommand()` 全局判断，在安装了 yarn 的机器上误用 `yarn add` 代替 `pnpm add`。修复后新增 `detectPackageManagerFromLockFile()` 方法，从当前目录向上遍历查找 `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`，正确识别 pnpm workspace。

## 0.0.5

### Patch Changes

- 09b8001: fix: 修复 pnpm 安装失败和版本号问题

  - 修复 pnpm `--reporter silent` 导致安装成功但返回 exit code 1 的问题
  - 模板版本号从 `"*"` 改为 `"workspace:^"`，生成时读取真实版本号
  - 新增 `readPackageVersion` 从 npm registry 读取最新版本号

## 0.0.4

### Patch Changes

- b8f4151: Fix package manager detection bugs:
  - Fix LRU cache key conflict causing wrong package manager to be detected
  - Fix async methods being called synchronously in constructor
  - Fix execa not checking exit code on failure
  - Fix pnpm add command using 'install' instead of 'add'
  - Remove incompatible --shamefully-hoist flag

## 0.0.3

### Patch Changes

- 81752e3: bump all packages to 0.0.3

## 0.0.2

### Patch Changes

- fix: bump version for npm publish
