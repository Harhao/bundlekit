---
title: 配置参考
order: 2
---

# .devkitrc.ts 配置参考

devkit 的核心配置文件，支持 TypeScript，提供完整的类型提示。

## 完整示例

```ts
import type { IBuildConfig } from "@devkit/shared-utils";

const pages = [
  {
    filename: "index.html",
    template: "public/index.html",
    entry: "src/index.tsx",
    inject: "body" as const,
  },
];

const config: IBuildConfig = {
  mode: "development",
  bundler: "webpack",
  plugins: ["@devkit/plugin-react", "@devkit/plugin-mock"],
  changeConfigure: (config, mode) => {
    if (mode === "production") return { ...config, devtool: false };
    return config;
  },
  config: {
    development: {
      target: "web",
      publicPath: "/",
      entry: "src/index.tsx",
      pages,
      output: { dir: "dist", filename: "[name].js", formats: "umd" },
      alias: { "@": "src" },
      js: { sourcemap: true, minify: false, splitChunks: true },
      css: { sourcemap: true, modules: true, extract: true, loaders: ["css", "less"] },
      devServer: {
        host: "0.0.0.0", port: 3000, https: false, open: true,
        proxy: {
          "/api": { target: "http://localhost:4000", changeOrigin: true, secure: false },
        },
      },
      externals: [],
    },
    production: {
      target: "web",
      publicPath: "/",
      entry: "src/index.tsx",
      pages,
      output: { dir: "dist", filename: "[name].[contenthash:8].js", formats: "umd" },
      alias: { "@": "src" },
      js: { sourcemap: false, minify: true, splitChunks: true },
      css: { sourcemap: false, modules: true, extract: true, loaders: ["css", "less"] },
      analyzer: true,
      externals: [],
    },
  },
};

export default config;
```

## 顶层字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `mode` | `IBuildEnv` | `"development"` | 默认构建环境 |
| `bundler` | `IBuildTools` | `"webpack"` | 默认打包器 |
| `plugins` | `string[]` | `[]` | 构建插件包名列表，由 devkit-service 在构建时加载 |
| `tools` | `IToolsHooks` | `undefined` | 按 bundler 分块的逃生舱钩子（详见下文） |
| `changeConfigure` | `Function` | `(c) => c` | 运行时修改打包器原生配置的全局兜底回调 |
| `config` | `Record<IBuildEnv, EnvConfig>` | 必填 | 各环境的构建配置 |

## 逃生舱（tools）

当 bundle-devkit 抽象出来的字段不够覆盖某个 bundler 的能力时，可以用 `tools.<bundler>` 直接拿到该 bundler 的原生 config 进行扩展。

**调用顺序**：

```
plugins.apply()  →  transformConfig()  →  tools[bundler]?(config, ctx)  →  changeConfigure()  →  run()
                                                  ▲
                                            按 bundler 精准匹配
```

**返回值约定**：

- 返回 `undefined` / `void` → 用 mutate 后的 config
- 返回新对象 → 替换原 config

**`ToolsCtx`**：

```ts
interface IToolsCtx {
  mode: IBuildEnv;            // 当前构建模式
  command: 'serve' | 'build'; // 当前命令
  env: 'client' | 'server';   // SSR 双 pass 区分（默认 'client'）
  bundler: IBuildTools;       // 当前激活的 bundler 名
}
```

**5 个 bundler 的最小用例**：

```ts
import type { IBuildConfig } from "@devkit/shared-utils";

const config: IBuildConfig = {
  bundler: "webpack",
  // ...
  tools: {
    webpack(config, { mode, env }) {
      if (mode === "production") config.devtool = false;
      // 注入自定义 plugin
      // config.plugins?.push(new MyWebpackPlugin());
    },

    vite(config, ctx) {
      // 在 vite 配置中追加 optimizeDeps
      config.optimizeDeps ??= {};
      (config.optimizeDeps.include ??= []).push("lodash-es");
    },

    rspack(config, ctx) {
      // 修改 rspack experiments
      (config as any).experiments = { ...(config as any).experiments, css: false };
    },

    rollup(config, ctx) {
      // 添加 rollup plugin
      // const arr = Array.isArray(config.plugins) ? config.plugins : [];
      // config.plugins = [...arr, myRollupPlugin()];
    },

    rolldown(config, ctx) {
      // rolldown 类型为 unknown，按需断言后修改
      const cfg = config as any;
      cfg.experimental = { ...cfg.experimental, enableComposingJsPlugins: true };
    },
  },
  // ...
};
```

> **若 bundler 未安装**：对应 `tools.<name>` 函数永远不会被调用（runtime 检测不到对应 bundler，service 会先走 [bundler 安装提示流程](/guide/bundlers)）；类型层因 `peerDependenciesMeta.optional` 与 `skipLibCheck` 也不会报错。



## 环境配置字段

每个环境（`development` / `production` / `test` / `staging` / `gray`）支持以下配置：

### 基础配置

```ts
{
  target: "web",           // 构建目标: "web" | "node"
  publicPath: "/",         // 公共路径前缀
  entry: "src/index.tsx",  // 入口文件，支持 string | Record<string, string>
  bundler: "vite",         // 环境级打包器（可覆盖顶层 bundler 字段）
  output: {
    dir: "dist",           // 输出目录
    filename: "[name].js", // 输出文件名，支持 contenthash 占位
    formats: "umd",        // 输出格式: "umd" | "esm" | "commonjs" | "iife"
  },
  framework: "react",      // 由构建插件自动写入，勿手动设置
}
```

> `framework` 字段由 `plugin-react` / `plugin-vue` 的 `apply()` 自动写入，各打包器据此加载对应 loader / 插件。通常无需手动填写。
>
> `bundler` 字段可在某个具体环境中单独覆盖顶层的 `bundler` 设置，例如开发环境用 vite，生产环境用 webpack。

### 多页面（pages）

```ts
pages: [
  {
    filename: "index.html",        // 输出 HTML 文件名
    template: "public/index.html", // HTML 模板路径
    entry: "src/index.tsx",        // 页面入口（Vite 使用）
    inject: "body",                // script 注入位置: "head" | "body"
  },
  {
    filename: "h5.html",
    template: "public/h5.html",
    entry: "src/h5.tsx",
    inject: "body",
  },
]
```

### JS 优化

```ts
js: {
  sourcemap: true,    // 是否生成 sourcemap
  minify: false,      // 是否压缩代码
  splitChunks: true,  // 是否启用代码分割
}
```

### CSS 配置

```ts
css: {
  sourcemap: true,                   // CSS sourcemap
  modules: true,                     // CSS Modules
  extract: true,                     // 提取 CSS 为独立文件
  loaders: ["css", "less", "sass"],  // 预处理器列表
  preload: true,                     // 是否预加载 CSS（link rel="preload"）
}
```

### 别名

```ts
alias: {
  "@": "src",
  "components": "src/components",
}
```

### 开发服务器

```ts
devServer: {
  host: "0.0.0.0",
  port: 3000,
  https: false,
  open: true,
  proxy: {
    "/api": {
      target: "http://localhost:4000",
      changeOrigin: true,
      secure: false,
    },
  },
}
```

### 资源注入

```ts
inject: {
  position: "head",    // 全局注入位置: "head" | "body"
  js: [
    { src: "https://cdn.example.com/init.js", defer: true },
    { src: "https://cdn.example.com/async.js", async: true },
    { content: "window.__INIT__ = true;", defer: false },  // 内联脚本
  ],
  css: [
    { href: "https://cdn.example.com/style.css", type: "link" },
    { href: "https://cdn.example.com/critical.css", preload: true },  // 预加载
    { content: "body { margin: 0; }", type: "inline" },               // 内联样式
  ],
}
```

### 资源拷贝

```ts
copy: [
  {
    from: "public/favicon.ico",
    to: "dist",
    ignore: "*.map",
    flatten: true,
  },
]
```

### 打包分析器

```ts
analyzer: true   // 生产构建后启动 bundle 分析器（webpack）
```

### 外部依赖

```ts
externals: ["react", "react-dom"]   // 不打入 bundle 的外部依赖
```

### SSR 配置

```ts
ssr: {
  entry: "src/entry-server.tsx",                    // 服务端入口（export render(url) => string | Promise<string>）
  output: {
    dir: "dist/server",                             // server bundle 输出目录
    filename: "server.cjs",                         // server bundle 文件名
    formats: "commonjs",                            // "commonjs" | "esm"
  },
  externals: "auto",                                // 'auto' | (string | RegExp)[]
  template: "public/index.html",                    // HTML 模板（dev SSR 用）
  placeholder: "<!--ssr-outlet-->",                 // HTML 中占位符（默认 "<!--ssr-outlet-->")
}
```

启用 SSR 后，`devkit-service build` 会**串行执行两次** — 客户端 + 服务端 bundle 各产一份。详见 [SSR 指南](/guide/ssr)。

> ⚠️ `ssr` 与 `pages[]` 互斥（第一版仅支持 SPA SSR），`ssr` 与 `target: 'node'` 互斥（server pass 自动切换 target）。
