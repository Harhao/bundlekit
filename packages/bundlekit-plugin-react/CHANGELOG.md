# @bundlekit/plugin-react

## 0.0.7

### Patch Changes

- Updated dependencies [adbfb8f]
  - @bundlekit/shared-utils@0.0.6

## 0.0.6

### Patch Changes

- 09b8001: fix: 修复 pnpm 安装失败和版本号问题

  - 修复 pnpm `--reporter silent` 导致安装成功但返回 exit code 1 的问题
  - 模板版本号从 `"*"` 改为 `"workspace:^"`，生成时读取真实版本号
  - 新增 `readPackageVersion` 从 npm registry 读取最新版本号

- Updated dependencies [09b8001]
  - @bundlekit/shared-utils@0.0.5

## 0.0.5

### Patch Changes

- d6a3baf: Fix tslib dependency in rollup bundler and update template versions

  - Move tslib from devDependencies to dependencies in @bundlekit/bundler-rollup to fix build error
  - Update template package versions from workspace:^ to \* for automatic latest version installation

## 0.0.4

### Patch Changes

- Updated dependencies [b8f4151]
  - @bundlekit/shared-utils@0.0.4

## 0.0.3

### Patch Changes

- 81752e3: bump all packages to 0.0.3
- Updated dependencies [81752e3]
  - @bundlekit/shared-utils@0.0.3

## 0.0.2

### Patch Changes

- fix: bump version for npm publish
- Updated dependencies
  - @bundlekit/shared-utils@0.0.2
