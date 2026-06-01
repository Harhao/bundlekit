---
title: AI Agent 集成（MCP）
order: 7
---

# AI Agent 集成（MCP Server）

`@bundlekit/cli-mcp` 把 BundleKit 的项目创建与插件管理能力暴露为 [Model Context Protocol](https://modelcontextprotocol.io)（MCP）工具，让 Cursor / Claude Desktop / Windsurf 等 AI 编程客户端能通过自然语言驱动 BundleKit。

## 安装

```bash
pnpm add -g @bundlekit/cli-mcp
# 或运行时通过 npx 直接拉起
npx @bundlekit/cli-mcp
```

二进制名：`bundlekit-cli-mcp`（stdio 模式启动）。

## 在 MCP 客户端中接入

在客户端配置文件中加入 server 定义即可（以 Cursor / Claude Desktop / Windsurf 通用格式为例）：

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

启动客户端后，模型会自动感知到下列 tools 可用。

## 可用 Tools

### `createProject`

创建由 BundleKit 驱动的新前端 / Node 项目。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | ✅ | 项目名（小写字母 / 数字 / `@` / `.` / `-` / `_`） |
| `template` | `string` |  | `react-ts` / `react-js` / `vue3-ts` / `vue3-js` / `node-ts` |
| `bundler` | `string` |  | `vite` / `webpack` / `rspack` / `rollup` / `rolldown` / `parcel` / `esbuild` |
| `description` | `string` |  | 项目描述 |
| `packageManager` | `string` |  | `pnpm` / `yarn` / `npm` |
| `ssr` | `boolean` |  | 启用 SSR（`node-ts` 模板不支持，传 true 会报错） |
| `cwd` | `string` |  | 工作目录（默认 `process.cwd()`） |

### `addPlugin`

向已有 BundleKit 项目追加插件或 bundler 适配器，等价 `bc add <name>`。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `plugin` | `string` | ✅ | 短名或全名（`react` / `vue` / `mock` / `request` / `vite` / `webpack` / `rspack` / `rollup` / `rolldown` / `parcel` / `esbuild` / `@bundlekit/plugin-*`） |
| `cwd` | `string` |  | 工作目录 |

### `listTemplates`

列出所有可用的模板、bundler、包管理器。无参数。

### `help`

获取 CLI 命令的帮助文本。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `command` | `string` |  | `create` / `add`，省略则返回总帮助 |

## 使用示例

向 AI 编程客户端说：

> 帮我创建一个名为 `my-app` 的 React TypeScript 项目，使用 Vite，启用 SSR。

模型会自动调用 `createProject`：

```json
{
  "tool": "createProject",
  "params": {
    "name": "my-app",
    "template": "react-ts",
    "bundler": "vite",
    "ssr": true
  }
}
```

执行成功后返回项目路径与下一步指引（`cd my-app && pnpm dev`）。

## 编程方式集成（HTTP）

如果你想把 MCP server 嵌入到自己的 HTTP 服务里：

```ts
import http from "http";
import { bundlekitMcpServer } from "@bundlekit/cli-mcp";

const server = http.createServer(async (req, res) => {
  await bundlekitMcpServer.startHTTP({
    url: new URL(req.url || "", "http://localhost:3000"),
    httpPath: "/mcp",
    req,
    res,
  });
});

server.listen(3000);
```

## 与 `bundlekit-docs-agent` 的关系

| 包 | 形态 | 作用 |
|---|---|---|
| `@bundlekit/cli-mcp` | MCP server | 把 `bc create` / `bc add` 暴露为 MCP tools，供 AI 客户端调用执行 |
| `@bundlekit/docs-agent` | Cloudflare Worker | 文档 RAG agent，把整套 bundlekit 文档向量化后提供 `POST /query` HTTP 接口 |

两者互补：`cli-mcp` 负责"动手做"，`docs-agent` 负责"答问题"。线上 agent 地址：[llm-chat-app.harhao.workers.dev](https://llm-chat-app.harhao.workers.dev)。

## 故障排查

- **MCP server 启动后客户端识别不到 tools**：确认客户端日志，检查 `command` / `args` 是否能在 shell 直接跑通；某些客户端要求绝对路径。
- **createProject 报项目名不合法**：MCP server 透传 CLI 校验规则，仅允许 `[a-z0-9@.\-_]`，重命名后重试。
- **addPlugin 后 plugin 没出现在 `.bundlekitrc.ts`**：检查 cwd 是否为 BundleKit 项目根（含 `.bundlekitrc.ts` 或 `.bundlekitrc.js`）。
