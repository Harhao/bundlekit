# @bundlekit/cli-mcp

BundleKit CLI 的 MCP（Model Context Protocol）服务器。此包将 BundleKit 的项目创建和插件管理功能暴露为 MCP 工具，允许 AI 代理以编程方式与 BundleKit 交互。

## 安装

```bash
pnpm add @bundlekit/cli-mcp
```

## 使用方式

### 作为 MCP 服务器（stdio）

直接运行服务器：

```bash
bundlekit-cli-mcp
```

或使用 npx：

```bash
npx @bundlekit/cli-mcp
```

### 在 MCP 客户端配置中使用

添加到您的 MCP 客户端配置（例如 Cursor、Windsurf、Claude Desktop）：

```json
{
  "mcpServers": {
    "bundlekit": {
      "command": "npx",
      "args": ["@bundlekit/cli-mcp"]
    }
  }
}
```

### 编程方式使用

```typescript
import { bundlekitMcpServer } from '@bundlekit/cli-mcp';

// 使用 stdio 传输启动
await bundlekitMcpServer.startStdio();

// 或集成到 HTTP 服务器
import http from 'http';

const httpServer = http.createServer(async (req, res) => {
  await bundlekitMcpServer.startHTTP({
    url: new URL(req.url || '', 'http://localhost:3000'),
    httpPath: '/mcp',
    req,
    res,
  });
});

httpServer.listen(3000);
```

## 可用工具

### `createProject`

创建由 BundleKit 驱动的新前端项目。

**参数：**
- `name`（字符串，必填）：项目名称
- `template`（字符串，可选）：项目模板（`react-ts`、`react-js`、`vue3-ts`、`vue3-js`）
- `bundler`（字符串，可选）：构建工具（`vite`、`webpack`、`rspack`、`rollup`、`rolldown`）
- `description`（字符串，可选）：项目描述
- `packageManager`（字符串，可选）：包管理器（`pnpm`、`yarn`、`npm`）
- `ssr`（布尔值，可选）：启用 SSR（服务端渲染）
- `cwd`（字符串，可选）：工作目录

### `addPlugin`

向已有的 BundleKit 项目添加插件或构建工具适配器。

**参数：**
- `plugin`（字符串，必填）：要添加的插件或构建工具名称（例如：`react`、`vue`、`mock`、`request`、`vite`、`webpack`、`rspack`、`rollup`、`rolldown`）
- `cwd`（字符串，可选）：已有项目的工作目录

### `listTemplates`

列出所有可用的项目模板、构建工具和包管理器。

**参数：** 无

### `help`

获取 bundlekit-cli 命令的帮助信息。

**参数：**
- `command`（字符串，可选）：要获取帮助的特定命令（例如：`create`、`add`）

## 使用示例

```
用户：创建一个名为 "my-app" 的新 React TypeScript 项目，使用 Vite

助手：我将为您使用 BundleKit MCP 服务器创建一个新的 React TypeScript 项目。

[助手调用 createProject 工具，参数如下：]
- name: "my-app"
- template: "react-ts"
- bundler: "vite"

助手：项目 "my-app" 创建成功，使用 react-ts 模板和 vite 构建工具。
```

## 许可证

MIT
