# @bundlekit/shared-utils

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
