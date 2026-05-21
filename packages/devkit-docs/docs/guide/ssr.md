---
title: SSR 服务端渲染
order: 5
---

# SSR 服务端渲染

bundle-devkit 在 5 个 bundler 上提供统一的 SSR 双产物（client + server）构建支持。

## 入口约定

```
my-app/
├── src/
│   ├── entry-client.tsx       # 客户端入口（hydrate）
│   ├── entry-server.tsx       # 服务端入口（export render(url): string | Promise<string>）
│   └── App.tsx                # 共享应用组件
├── public/
│   └── index.html             # 含 <!--ssr-outlet--> 占位
└── .devkitrc.ts               # 含 ssr 配置块
```

## 配置示例

```ts
import type { IBuildConfig } from "@devkit/shared-utils";

const config: IBuildConfig = {
  bundler: "vite",
  mode: "production",
  plugins: ["@devkit/plugin-react"],
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

```tsx
// src/entry-server.tsx
import { renderToString } from "react-dom/server";
import App from "./App";

export function render(url: string): string {
  return renderToString(<App url={url} />);
}
```

## 客户端入口

```tsx
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
devkit-service build --bundler vite --mode production
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
| vite | ✅ | ✅ | ✅ | `ssrLoadModule` 原生支持 |
| webpack | ✅ | ⚠️ 进程级 | 待补充 | dev middleware 后续 release |
| rspack | ✅ | ⚠️ 进程级 | 待补充 | dev middleware 后续 release |
| rollup | ❌ | ❌ | 待补充 | watch + 进程重启 |
| rolldown | ❌ | ❌ | 待补充 | watch + 进程重启 |

> **当前 release**：5 个 bundler 的 build SSR 已全部就绪。Vite 还提供 dev SSR middleware (`createSSRMiddleware`)。其他 4 个 bundler 的 dev SSR middleware 在后续 release 中补齐 — 目前 dev 模式仅 vite 可走 SSR 流水线。

## 互斥规则

```
.devkitrc.ts 校验时若同时声明以下，启动报错退出：
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
