---
title: 插件系统
order: 5
---

# 插件系统

devkit 插件分两类，定位和用法截然不同：

| 类型 | 包名规范 | 配置位置 | 用途 |
|------|---------|---------|------|
| 构建插件 | `@devkit/plugin-*` | `.devkitrc.ts` `plugins[]` | 在构建阶段修改打包器配置 |
| 运行时库 | `@devkit/*`（无 plugin-） | `package.json` `dependencies` | 在前端业务代码中 import 使用 |

---

## 构建插件

构建插件通过 `plugins[]` 声明，devkit-service 启动时自动加载并调用 `apply()`。

### 工作机制

```
plugins: ["@devkit/plugin-react"]
    ↓ Service.resolvePlugins() 动态 import
    ↓ plugin.apply(api, buildConfig)
    ↓ buildConfig.config[env].framework = "react"
    ↓ 各打包器 transformConfig 读取 framework
         webpack  → ts-loader 加 jsx:"react-jsx"
         vite     → 动态加载 @vitejs/plugin-react
         rspack   → swc-loader 加 tsx:true + react runtime
```

插件只负责写入抽象配置字段（`framework`），各打包器负责将其转化为自身的原生配置，做到"写一次，所有打包器生效"。

### 构建插件接口

```ts
export default {
  defaultModes: { "plugin:name": "development" },
  apply(api: IPluginAPIClass, buildConfig: IBuildConfig) {
    // 修改构建配置
    for (const env of Object.keys(buildConfig.config || {})) {
      buildConfig.config[env].framework = "react";
    }
    api.modifyBuildConfig(buildConfig);
  },
};
```

**PluginAPI 可用方法：**

| 方法 / 属性 | 说明 |
|------|------|
| `api.modifyBuildConfig(config)` | 更新构建配置 |
| `api.registerCommand(name, opts, fn)` | 注册自定义 devkit-service 命令 |
| `api.addBuildPackage(pkg)` | 安装额外 npm 包 |
| `api.getCwd()` | 获取项目根目录（等同于 `process.cwd()`） |
| `api.pluginName` | 当前插件的 ID（只读） |
| `api.version` | devkit-service 的版本号（只读） |
| `api.service.getBuildConfig()` | 读取当前构建配置 |
| `api.service.logger` | 日志工具 |

---

### React 插件

包名：`@devkit/plugin-react`

```ts
plugins: ["@devkit/plugin-react"]
```

**效果：**在所有环境的配置中写入 `framework: "react"`，各打包器据此启用 JSX 编译支持：

- **webpack**：ts-loader 加入 `jsx: "react-jsx"`、`jsxImportSource: "react"`
- **vite**：动态加载 `@vitejs/plugin-react`（React Fast Refresh）
- **rspack**：swc-loader 加入 `tsx: true`、`react.runtime: "automatic"`

---

### Vue 3 插件

包名：`@devkit/plugin-vue`

```ts
plugins: ["@devkit/plugin-vue"]
```

**效果：**写入 `framework: "vue3"`，各打包器据此启用 `.vue` SFC 支持：

- **webpack**：加入 `vue-loader` + `VueLoaderPlugin`，`extensions` 加入 `.vue`
- **vite**：动态加载 `@vitejs/plugin-vue`
- **rspack**：`extensions` 加入 `.vue`，加入 `vue-loader`

---

### Mock 插件

包名：`@devkit/plugin-mock`

```ts
plugins: ["@devkit/plugin-mock"]
```

**效果：** 注册一个 `plugin:mock` 命令，启动本地 Mock Server（默认端口 4000），并将 `/api` 流量通过 `devServer.proxy` 代理到该 Mock Server。

```bash
# 在开发服务启动前，先单独启动 Mock Server
devkit-service plugin:mock
```

**mock 数据格式（`mock/db.json`）：**

```json
{
  "users": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" },
    { "id": 2, "name": "Bob",   "email": "bob@example.com" }
  ],
  "posts": [
    { "id": 1, "title": "Hello devkit", "userId": 1 }
  ]
}
```

访问方式：`GET /api/users`、`POST /api/users`、`PUT /api/users/1`、`DELETE /api/users/1`

---

## 运行时库

### @devkit/request

HTTP 客户端，支持 axios / fetch 双引擎，统一 API。

**安装：**

```bash
pnpm add @devkit/request
# 或通过 CLI 追加
devkit-cli add request
```

**使用（`src/api/index.ts`）：**

```ts
import { createRequest } from "@devkit/request";

const http = createRequest({
  engine: "axios",       // "axios"（默认）| "fetch"
  baseURL: "/api",
  timeout: 10000,
  interceptors: {
    request: (config) => {
      const token = localStorage.getItem("token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    response: (data) => data,
  },
});

export default http;
```

**在组件中使用：**

```ts
import http from "@/api";

const { data: users } = await http.get<User[]>("/users");
const { data: user }  = await http.post<User>("/users", { name: "Alice" });
await http.put("/users/1", { name: "Bob" });
await http.delete("/users/1");
```

**切换引擎：** 只需修改 `engine` 字段，业务代码无需任何改动：

```ts
// 切换到原生 fetch（无需安装 axios）
const http = createRequest({ engine: "fetch", baseURL: "/api" });
```

---

## 开发自定义构建插件

```ts
// my-plugin.ts
import type { IPluginAPIClass, IBuildConfig } from "@devkit/shared-utils";

export default {
  defaultModes: { "my-plugin": "development" as const },
  apply(api: IPluginAPIClass, options: IBuildConfig) {
    const buildConfig = api.service.getBuildConfig();
    if (!buildConfig) return;

    // 修改抽象配置字段
    for (const env of Object.keys(buildConfig.config || {})) {
      (buildConfig.config[env] as any).myField = "value";
    }
    api.modifyBuildConfig(buildConfig);

    // 注册自定义命令
    api.registerCommand("my-cmd", {
      description: "我的命令",
      usage: "devkit-service my-cmd",
      options: { "--port": "端口号" },
    }, async (args) => {
      api.service.logger.log(`运行中，端口: ${args.port}`);
    });
  },
};
```

在 `.devkitrc.ts` 中加载：

```ts
plugins: ["./my-plugin"]   // 相对路径或 npm 包名
```

### 为插件添加 generator

generator 让 `devkit-cli add my-plugin` 能自动更新项目配置，并通过 `IGeneratorAPI` 接口与 CLI 交互（询问、日志）——generator 不感知底层使用什么提示库，CLI 负责实现。

**generator 签名：**

```ts
// my-plugin/generator/index.ts
import { addPluginToConfig } from "@devkit/shared-utils";
import type { IGeneratorAPI } from "@devkit/shared-utils";

export default async function generate(
  context: string,
  api: IGeneratorAPI
): Promise<void> {
  // 1. 将插件名写入 .devkitrc.ts plugins[]
  addPluginToConfig(context, "my-plugin");

  // 2. 通过 api.prompt() 向用户询问（底层由 CLI 的 Enquirer 驱动）
  const { installRequest } = await api.prompt<{ installRequest: boolean }>([
    {
      type: "confirm",
      name: "installRequest",
      message: "是否同时安装 @devkit/request HTTP 客户端？",
      initial: false,
    },
  ]);

  if (installRequest) {
    // 3. 声明依赖，CLI 统一安装（推荐方式）
    api.addDependency("@devkit/request", "^1.0.0", false);
    api.log("@devkit/request 已加入安装队列");
  }
}
```

**`IGeneratorAPI` 接口（来自 `@devkit/shared-utils`）：**

```ts
export interface IGeneratorAPI {
  /** 向用户发起交互式提问，底层由 CLI 的 Enquirer 驱动 */
  prompt<T extends Record<string, any>>(questions: any[]): Promise<T>;
  /** 输出成功提示 */
  log(message: string): void;
  /** 声明需要安装的 npm 依赖，CLI 统一安装 */
  addDependency(pkgName: string, version?: string, dev?: boolean): void;
}
```

**职责分离：**

| 层 | 负责 |
|---|---|
| `devkit-cli/AddCommand` | Enquirer 实例化，实现 `IGeneratorAPI`，调用 `generate(context, api)` |
| `@devkit/shared-utils` | 定义 `IGeneratorAPI` 接口契约 |
| `my-plugin/generator` | 业务逻辑，只调用 `api.prompt()` / `api.log()`，不依赖任何提示库 |
