---
"@bundlekit/shared-utils": patch
"@bundlekit/cli": patch
"@bundlekit/plugin-react": patch
"@bundlekit/plugin-vue": patch
---

fix: 修复 pnpm 安装失败和版本号问题

- 修复 pnpm `--reporter silent` 导致安装成功但返回 exit code 1 的问题
- 模板版本号从 `"*"` 改为 `"workspace:^"`，生成时读取真实版本号
- 新增 `readPackageVersion` 从 npm registry 读取最新版本号
