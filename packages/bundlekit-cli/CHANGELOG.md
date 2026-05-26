# @bundlekit/cli

## 0.0.7

### Patch Changes

- adbfb8f: feat: 新增 Parcel 2 打包器适配器，修复 pnpm 检测误判

  **@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

  **@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"`；`BUNDLER_PACKAGE_MAP` 新增 `parcel → @bundlekit/bundler-parcel`；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 两处 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式在版本不匹配时拦截检测命令、导致 pnpm 被误报为未安装。

  **@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel；`detectAvailablePMs` 同步修复 `COREPACK_ENABLE_STRICT: '0'`，并补充 `result.error` 检查；CLI rollup external 加入 `@bundlekit/bundler-parcel`。

- Updated dependencies [adbfb8f]
- Updated dependencies [a19cb50]
  - @bundlekit/shared-utils@0.0.6
  - @bundlekit/plugin-react@0.0.7
  - @bundlekit/plugin-vue@0.0.7

## 0.0.6

### Patch Changes

- 09b8001: fix: 修复 pnpm 安装失败和版本号问题

  - 修复 pnpm `--reporter silent` 导致安装成功但返回 exit code 1 的问题
  - 模板版本号从 `"*"` 改为 `"workspace:^"`，生成时读取真实版本号
  - 新增 `readPackageVersion` 从 npm registry 读取最新版本号

- Updated dependencies [09b8001]
  - @bundlekit/shared-utils@0.0.5
  - @bundlekit/plugin-react@0.0.6
  - @bundlekit/plugin-vue@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [d6a3baf]
  - @bundlekit/plugin-react@0.0.5
  - @bundlekit/plugin-vue@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [b8f4151]
  - @bundlekit/shared-utils@0.0.4
  - @bundlekit/plugin-react@0.0.4
  - @bundlekit/plugin-vue@0.0.4

## 0.0.3

### Patch Changes

- 81752e3: bump all packages to 0.0.3
- Updated dependencies [81752e3]
  - @bundlekit/plugin-react@0.0.3
  - @bundlekit/shared-utils@0.0.3
  - @bundlekit/plugin-vue@0.0.3

## 0.0.2

### Patch Changes

- fix: bump version for npm publish
- Updated dependencies
  - @bundlekit/plugin-react@0.0.2
  - @bundlekit/plugin-vue@0.0.2
  - @bundlekit/shared-utils@0.0.2
