---
title: 打包器适配器
order: 4
---

# 打包器适配器

bundlekit 通过 `IBuildToolAdapter` 接口统一五种打包器，一套 `.bundlekitrc.ts` 配置即可在所有打包器中运行。

## 支持的打包器

| 打包器 | 包名 | 状态 |
|--------|------|------|
| Webpack | `@bundlekit/bundler-webpack` | Webpack 5 + webpack-dev-server 5 |
| Vite | `@bundlekit/bundler-vite` | Vite 4 + 框架感知插件 |
| Rollup | `@bundlekit/bundler-rollup` | Rollup 4 + Babel + TypeScript |
| Rspack | `@bundlekit/bundler-rspack` | Rspack 1.x + SWC loader |
| Rolldown | `@bundlekit/bundler-rolldown` | Rolldown 1.x（Rust 实现，实验性） |

## Bundler 安装方式

`@bundlekit/service` **不再硬绑** bundler 适配器。三种方式让项目获得需要的 bundler：

### 方式一：`bundlekit-cli create` 时写入

```bash
bundlekit-cli create my-app -b vite
# my-app/package.json 的 devDependencies 中自动包含 @bundlekit/bundler-vite
```

### 方式二：`bundlekit-cli add` 在已有项目追加

```bash
bundlekit-cli add bundler-vite        # 完整短名
bundlekit-cli add vite                # 简短形式
bundlekit-cli add @bundlekit/bundler-vite  # 全名
```

三种写法等价，都会把对应 bundler 装入项目的 `devDependencies`。

### 方式三：运行时缺失提示

```bash
bundlekit-service serve --bundler rspack
# 若 @bundlekit/bundler-rspack 未安装，service 会提示：
#   未安装 @bundlekit/bundler-rspack，是否现在安装? (Y/n)
```

| 环境变量 | 行为 |
|---|---|
| `DEVKIT_NO_PROMPT=1` | 即使在 TTY 也不弹 prompt，缺失即报错退出 |
| `DEVKIT_AUTO_INSTALL=1` | 非 TTY 环境（CI）自动安装至 devDependencies |


## 工作原理

```
.bundlekitrc.ts
    ↓ ConfigLoader 解析
IBuildConfig（抽象配置）
    ↓ 构建插件 apply() 写入 framework 等字段
    ↓ Bundler.transformConfig()
各打包器原生配置
    ↓ Bundler.run()
构建产物
```

每个适配器实现相同接口：

```ts
interface IBuildToolAdapter<T = any> {
  name: string;
  transformConfig(config: IBuildConfig): T;
  validateConfig?(config: T, buildConfig?: IBuildConfig): boolean;  // 可选
  run(config: T): Promise<void>;
}
```

## 切换打包器

无需修改配置文件，通过 `--bundler` 参数即可切换：

```bash
bundlekit-service serve --bundler vite       # 开发优先，秒级热更新
bundlekit-service serve --bundler rspack     # Rust 实现，冷启动极速
bundlekit-service build --bundler webpack    # 生态最完整
bundlekit-service build --bundler rollup     # 适合库打包
```

## 各打包器特性

### Webpack

- ts-loader + thread-loader 多线程 TypeScript 编译
- 按 `framework` 字段自动注入 JSX / Vue 支持：
  - `react` → `jsx: "react-jsx"` 编译选项
  - `vue3` → vue-loader + VueLoaderPlugin，extensions 加 `.vue`
- HtmlWebpackPlugin 多页面支持（读取 `pages[]` 配置）
- webpack-dev-server 5 HMR，proxy 自动转换为数组格式
- 代码分割、sourcemap、bundle 分析器
- **SSR**：build 双 pass（client + server），dev 通过 `createSSRMiddleware` 提供 HTTP SSR 渲染（webpack-dev-middleware + webpack-hot-middleware），server compiler 独立 watch 编译到磁盘

### Vite

- 原生 ESM 开发服务器，毫秒级热更新
- 按 `framework` 字段动态加载框架插件（不再硬编码）：
  - `react` → 动态 `import @vitejs/plugin-react`
  - `vue3` → 动态 `import @vitejs/plugin-vue`
- vite-plugin-html 多页面支持
- terser 生产压缩
- **SSR**：原生支持，dev 用 `createServer({ middlewareMode: true })` + `ssrLoadModule` + `transformIndexHtml`，client + server HMR 全双工

### Rspack

- Rust 实现，Webpack API 兼容，约 10x 构建速度提升
- builtin:swc-loader 按 `framework` 字段配置：
  - `react` → `tsx: true` + `react.runtime: "automatic"`
  - `vue3` → `tsx: true` + vue-loader（实验性）
- HtmlRspackPlugin 多页面支持
- RspackDevServer HMR 热更新
- **SSR**：行为镜像 webpack；`createSSRMiddleware` 提供 HTTP dev SSR，server compiler 独立 watch 编译，build SSR 全功能，dev SSR HMR 以 React Fast Refresh（client 侧）为主

### Rollup

- 轻量级，适合库构建（输出 ESM / CJS / UMD）
- @rollup/plugin-image 图片资源处理
- rollup-plugin-postcss CSS / Less / Sass 处理
- watch 模式自动重构建

### Rolldown

- Rust 实现，Rollup API 兼容（实验性）
- 内置 TypeScript / JSX 变换，无需额外 loader
- `experimental.enableComposingJsPlugins` 启用插件组合

## 配置字段映射

`IBuildConfig` 抽象字段到各打包器配置的映射：

| IBuildConfig 字段 | Webpack | Vite | Rollup | Rspack |
|-------------------|---------|------|--------|--------|
| `entry` | `entry` | `rollupOptions.input` | `input` | `entry` |
| `output.dir` | `output.path` | `build.outDir` | `output.dir` | `output.path` |
| `alias` | `resolve.alias` | `resolve.alias` | `resolve.alias` | `resolve.alias` |
| `framework` | ts-loader jsx / vue-loader | plugin-react / plugin-vue | - | swc-loader options |
| `pages` | HtmlWebpackPlugin × n | createHtmlPlugin pages | - | HtmlRspackPlugin × n |
| `devServer.host` | `devServer.host` | `server.host` | - | `devServer.host` |
| `devServer.port` | `devServer.port` | `server.port` | - | `devServer.port` |
| `devServer.proxy` | `devServer.proxy`（数组） | `server.proxy` | - | `devServer.proxy` |
| `js.sourcemap` | `devtool` | `build.sourcemap` | `output.sourcemap` | `devtool` |
| `js.minify` | `optimization.minimize` | `build.minify` | - | `optimization.minimize` |
| `js.splitChunks` | `optimization.splitChunks` | `manualChunks` | - | `optimization.splitChunks` |
| `css.loaders` | css/less/sass-loader | preprocessorOptions | postcss use | style/less/sass-loader |

## SSR 支持矩阵

| Bundler | build SSR | dev SSR | client HMR | server HMR |
|---|---|---|---|---|
| vite | ✅ | ✅ | ✅ | ✅ |
| webpack | ✅ | ✅ | ✅ | ⚠️ 进程级 |
| rspack | ✅ | ✅ | ✅ | ⚠️ 进程级 |
| rollup | ✅ | ✅ | ❌ | ❌ |
| rolldown | ✅ | ✅ | ❌ | ❌ |

> dev SSR = 开发模式下通过 `createSSRMiddleware` 提供 HTTP SSR 渲染能力。Vite 提供全双工 HMR；webpack/rspack 支持 client HMR（React Fast Refresh），server 侧进程级更新；rollup/rolldown 无原生 HMR，修改后需重启进程。详见 [SSR 指南](/guide/ssr)。
