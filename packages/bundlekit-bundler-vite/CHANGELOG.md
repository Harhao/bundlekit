# @bundlekit/bundler-vite

## 0.0.11

### Patch Changes

- d544872: 修复安装依赖寻找路径的问题

## 0.0.10

### Patch Changes

- 27845b4: 修复切换 bundler 会报安装依赖失败问题

## 0.0.9

### Patch Changes

- 8e12ab8: 修复项目初始化异常和启动开发环境异常
- Updated dependencies [8e12ab8]
  - @bundlekit/shared-utils@0.0.9

## 0.0.8

### Patch Changes

- fb94642: feat(library): 类库 / SDK 打包模式全 7 个 bundler 完整支持

  之前 `library: true` / `libraryName: "MyLib"` 字段只在 rollup / rolldown / parcel 上有效，且 esbuild 的 UMD 是降级到 iife 的（没全局变量名）。这一轮把支持矩阵补齐：

  ### 各 adapter 改动

  - **@bundlekit/bundler-webpack / rspack**：之前两家不读 `library` 字段，client pass 始终设 `output.library`。现在：
    - `library: true` 时跳过 `HtmlWebpackPlugin` / `HtmlRspackPlugin`（不产 SPA shell HTML）
    - `libraryName` 填到 `output.library.name`，UMD 自动加 `umdNamedDefine + globalObject`
    - format 标准化映射：`esm → 'module'`（开 `experiments.outputModule`）/ `commonjs → 'commonjs2'` / `umd / iife / amd` 透传
  - **@bundlekit/bundler-vite**：之前 vite adapter 完全不读 `library` 字段。现在 `library: true` 走 vite 原生 `build.lib` 模式：
    - `formats` 数组转 vite 的 `lib.formats`，UMD/IIFE 自动塞 `lib.name = libraryName`
    - 跳过 `vite-plugin-html`，文件名按 `<entry>.<format-ext>` 命名
    - 默认把 `package.json` 的 `dependencies + peerDependencies` 自动 externalize（react/vue/react-dom 自带 globals 映射）
  - **@bundlekit/bundler-esbuild**：UMD 不再降级 iife，而是 `format: iife + globalName + banner/footer` 包真 UMD wrapper（CJS / AMD / Browser 三种宿主都能跑）

  ### CLI 改动

  - `bc create <name> --lib --library-name <name>`：新增 `--lib` 与 `--library-name` flag，TTY / non-TTY 两条路径都接上
  - 默认 `libraryName` 取项目名转 PascalCase（`my-lib` → `MyLib`），用户可显式覆盖
  - `--lib` 自动跳过 SSR prompt（语义不兼容）

  ### 模板改动

  - `@bundlekit/plugin-react / plugin-vue` 各自加：
    - `src/lib-entry.{tsx|jsx|ts|js}.ejs`：generator 在 library 模式下重命名为 `src/index.<ext>`，re-export `App` + 默认导出 `<%= libraryName %>`
    - `.bundlekitrc.{ts|js}.ejs` 加 `<% if (library) %>` 顶层分支：多格式 `["esm","commonjs","umd"]`、`library: true` + `libraryName`、`externals: ["react","react-dom"]` / `["vue"]`、不含 `pages`、不含 `devServer`
    - Library 模式下 generator 跳过 `public/`、`index.{tsx|jsx}`、`main.{ts|js}`、entry-server / entry-client（这些都是应用 mount 入口，SDK 用不到）

  ### 测试覆盖

  新增 14 个 build 集成测试（7 bundler × 2 模式）：

  - `build/<bundler>-lib.test.ts`：基础 CJS lib build，require 出 `add(2,3)===5`
  - `build/<bundler>-lib-umd.test.ts`：UMD build，验证产物含 `libraryName`，用 vm 在伪 browser 环境 eval 后 `globalThis.MyLib.add(2,3)===5`
    - parcel 此项 skip：Parcel 原生只支持 commonjs/global outputFormat，没 UMD wrapper

  新增 3 个 CLI `--lib` 集成测试：验证 react-ts / vue3-ts library 模式下文件结构 + `.bundlekitrc.ts` 内容 + `--library-name` 覆盖默认值。

  ### 支持矩阵

  | 能力                           | rollup | rolldown | webpack       | rspack        | vite   | esbuild       | parcel      |
  | ------------------------------ | ------ | -------- | ------------- | ------------- | ------ | ------------- | ----------- |
  | `library` / `libraryName` 字段 | ✅     | ✅       | **✅**        | **✅**        | **✅** | **✅**        | ✅          |
  | 真 UMD（含全局名）             | ✅     | ✅       | **✅**        | **✅**        | **✅** | **✅**        | ❌          |
  | 多格式同时输出                 | ✅     | ✅       | 取 formats[0] | 取 formats[0] | **✅** | 取 formats[0] | 仅 commonjs |
  | Library 跳过 HTML 入口         | ✅     | ✅       | **✅**        | **✅**        | **✅** | ✅            | ✅          |
  | 自动 external peerDeps         | 透传   | 透传     | 透传          | 透传          | **✅** | 透传          | 透传        |

  加粗 = 本次新增能力。

- Updated dependencies [0ef5a9b]
  - @bundlekit/shared-utils@0.0.8

## 0.0.7

### Patch Changes

- Updated dependencies [a031ba5]
  - @bundlekit/shared-utils@0.0.7

## 0.0.6

### Patch Changes

- Updated dependencies [a19cb50]
  - @bundlekit/shared-utils@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [09b8001]
  - @bundlekit/shared-utils@0.0.5

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
