---
title: SSR 服务端渲染
order: 5
---

# SSR 服务端渲染

bundle-bundlekit 在 5 个 bundler 上提供统一的 SSR 双产物（client + server）构建支持。

## 入口约定

```
my-app/
├── src/
│   ├── entry-client.tsx       # 客户端入口（hydrate）
│   ├── entry-server.tsx       # 服务端入口（export render(url): string | Promise<string>）
│   └── App.tsx                # 共享应用组件
├── public/
│   └── index.html             # 含 <!--ssr-outlet--> 占位
└── .bundlekitrc.ts               # 含 ssr 配置块
```

## 配置示例

```ts
import type { IBuildConfig } from "@bundlekit/shared-utils";

const config: IBuildConfig = {
  bundler: "vite",
  mode: "production",
  plugins: ["@bundlekit/plugin-react"],
  changeConfigure: (c) => c,
  config: {
    production: {
      target: "web",
      publicPath: "/",
      entry: "src/entry-client.tsx",
      output: { dir: "dist/client", filename: "[name].js", formats: "esm" },
      alias: { "@": "src" },
      externals: [],
      ssr: {
        entry: "src/entry-server.tsx",
        output: {
          dir: "dist/server",
          filename: "server.cjs",
          formats: "commonjs",
        },
        externals: "auto",
        template: "public/index.html",
        placeholder: "<!--ssr-outlet-->",
      },
    },
  },
};

export default config;
```

## 服务端入口

```js
// src/entry-server.tsx
import { renderToString } from "react-dom/server";
import App from "./App";

export function render(url: string): string {
  return renderToString(<App url={url} />);
}
```

## 客户端入口

```js
// src/entry-client.tsx
import { hydrateRoot } from "react-dom/client";
import App from "./App";

hydrateRoot(document.getElementById("app")!, <App url={location.pathname} />);
```

## HTML 模板

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>SSR App</title>
</head>
<body>
  <div id="app"><!--ssr-outlet--></div>
</body>
</html>
```

## Build 行为

```bash
bundlekit-service build --bundler vite --mode production
```

`Service.startBuilder` 检测到 `envConfig.ssr` 后会**串行执行两次构建**：

```
┌─────────────────────────────────┐
│  Pass 1: client                 │
│   target='web'                  │
│   entry  = envConfig.entry      │
│   output = envConfig.output     │
│   → dist/client/                │
└─────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Pass 2: server                 │
│   target='node'                 │
│   entry  = ssr.entry            │
│   output = ssr.output           │
│   externals = node_modules auto │
│   → dist/server/server.cjs      │
└─────────────────────────────────┘
```

## externals 处理

| 配置 | 行为 |
|---|---|
| `externals: 'auto'` | 自动 externalize 项目 `dependencies` / `peerDependencies` 与所有 `node:` 内置模块 |
| `externals: ['react', /^@scope\//]` | 显式数组：按字符串 / 正则匹配 |
| 不配置 | 等价 `'auto'`，避免双 react 实例等问题 |

## HMR 支持矩阵

| Bundler | client HMR | server HMR | dev SSR middleware | 备注 |
|---|---|---|---|---|
| vite | ✅ | ✅ | ✅ | `ssrLoadModule` 原生支持，全双工 HMR |
| webpack | ✅ | ⚠️ 进程级 | ✅ | webpack-dev-middleware + HMR，server 侧 watch 重编译 |
| rspack | ✅ | ⚠️ 进程级 | ✅ | 行为镜像 webpack，client Fast Refresh 可用 |
| rollup | ❌ | ❌ | ✅ | watch 模式 + 进程级重启 |
| rolldown | ❌ | ❌ | ✅ | watch 模式 + 进程级重启 |

> **当前 release**：5 个 bundler 的 build SSR 与 dev SSR (`createSSRMiddleware`) 均已就绪。Vite 提供全双工 HMR；webpack / rspack 提供 client HMR + server 进程级更新；rollup / rolldown 的 watch 模式下修改 server bundle 需手动重启进程。

## 互斥规则

```
.bundlekitrc.ts 校验时若同时声明以下，启动报错退出：
  ├─ ssr  +  target: 'node'    ← server pass 自动切 target，无需手动声明
  └─ ssr  +  pages[]            ← 第一版仅支持 SPA SSR
```

## 与 tools 钩子协同

启用 SSR 后，`tools.<bundler>` 钩子在两次 pass 都会被调用，`ctx.env` 区分 `'client'` / `'server'`：

```ts
tools: {
  webpack(config, { env, mode }) {
    if (env === "server") {
      // server pass 专用调整
      config.target = "node";
    }
  },
}
```

## 常见错误

- **render is not a function**：`entry-server.tsx` 必须 `export function render(url) { ... }`
- **占位符未替换**：HTML 模板中需含 `<!--ssr-outlet-->`（或 `ssr.placeholder` 自定义的占位）
- **server bundle 体积巨大**：检查 `externals: 'auto'` 是否生效，验证 `dist/server/server.cjs` 应该只有源码量级
- **双 react 实例**：通常因 react 没被 externalize 导致 — 配 `externals: ['react', 'react-dom']` 或 `'auto'`

## 迁移示例

### react-ts：从 CSR 改 SSR

**1. 拆出 App 组件**（`src/App.tsx`）：

```diff
- // src/index.tsx：原 CSR 入口
- import React from 'react';
- import { createRoot } from 'react-dom/client';
- const App = () => <h1>Hello</h1>;
- createRoot(document.getElementById('root')!).render(<App />);
+ // src/App.tsx：纯 React 组件
+ import React from 'react';
+ const App: React.FC = () => <h1>Hello</h1>;
+ export default App;
```

**2. 新增 client 入口**（`src/entry-client.tsx`）：

```js
import React from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root')!;
if (container.firstChild) {
    hydrateRoot(container, <App />);
} else {
    createRoot(container).render(<App />);
}
```

**3. 新增 server 入口**（`src/entry-server.tsx`）：

```js
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

export function render(url: string): string {
    return renderToString(<App />);
}
```

**4. HTML 加占位符**（`public/index.html`）：

```diff
- <div id="root"></div>
+ <div id="root"><!--ssr-outlet--></div>
```

**5. `.bundlekitrc.ts` 配置**：

```diff
  config: {
    production: {
      target: "web",
-     entry: "src/index.tsx",
+     entry: "src/entry-client.tsx",
-     pages: [{ entry: "src/index.tsx", template: "public/index.html", filename: "index.html", inject: "body" }],
+     ssr: {
+       entry: "src/entry-server.tsx",
+       output: { dir: "dist/server", filename: "server.cjs", formats: "commonjs" },
+       externals: "auto",
+       template: "public/index.html",
+       placeholder: "<!--ssr-outlet-->",
+     },
      output: { dir: "dist/client", filename: "[name].js", formats: "umd" },
    },
  },
```

**6. 跑构建**：

```bash
$ bundlekit-service build --bundler vite --mode production
# dist/client/main.js   客户端 bundle
# dist/server/server.cjs   服务端 bundle，可 require + render('/')
```

> 💡 用 `bundlekit-cli create my-app -t react-ts --ssr` 直接生成 SSR 项目骨架，跳过手工迁移。

### vue3-ts：从 CSR 改 SSR

**1. App.vue 保持不变**（普通 SFC 即可）

**2. 新增 client 入口**（`src/entry-client.ts`）：

```ts
import { createSSRApp } from 'vue';
import App from './App.vue';

createSSRApp(App).mount('#app', true);  // hydration 模式
```

**3. 新增 server 入口**（`src/entry-server.ts`）：

```ts
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from './App.vue';

export async function render(url: string): Promise<string> {
    const app = createSSRApp(App);
    return await renderToString(app);
}
```

**4. HTML 加占位符**（同 react-ts）

**5. `.bundlekitrc.ts`**：

```diff
  config: {
    production: {
-     entry: "src/main.ts",
+     entry: "src/entry-client.ts",
-     pages: [{ entry: "src/main.ts", ... }],
+     ssr: {
+       entry: "src/entry-server.ts",
+       output: { dir: "dist/server", filename: "server.cjs", formats: "commonjs" },
+       externals: "auto",
+       template: "public/index.html",
+       placeholder: "<!--ssr-outlet-->",
+     },
    },
  },
```

> 💡 vue 模板用 `dc create my-app -t vue3-ts --ssr` 自动生成。
