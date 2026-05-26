---
"@bundlekit/bundler-parcel": patch
"@bundlekit/shared-utils": patch
"@bundlekit/cli": patch
---

feat: 新增 Parcel 2 打包器适配器，修复 pnpm 检测误判

**@bundlekit/bundler-parcel**（新包）：实现 `IBuildToolAdapter` 接口，支持开发模式 watch + DevServer、生产构建、Library 模式及 dev SSR middleware（通过 `bundleGraph` 动态获取实际产物路径，兼容 Parcel 重命名输出文件的行为）。

**@bundlekit/shared-utils**：`IBuildTools` 联合类型新增 `"parcel"`；`BUNDLER_PACKAGE_MAP` 新增 `parcel → @bundlekit/bundler-parcel`；`hasPnpmVersionOrLater` / `hasPnpm3OrLater` 两处 `spawnSync` 调用统一加入 `COREPACK_ENABLE_STRICT: '0'`，防止 corepack strict 模式在版本不匹配时拦截检测命令、导致 pnpm 被误报为未安装。

**@bundlekit/cli**：bundler 选项列表与 ink UI 二级菜单新增 Parcel；`detectAvailablePMs` 同步修复 `COREPACK_ENABLE_STRICT: '0'`，并补充 `result.error` 检查；CLI rollup external 加入 `@bundlekit/bundler-parcel`。
