<p align="center"></p>

<h1 align="center">BundleKit</h1>

<p align="center">
  前端多构建器工具集——一套配置，驱动多种构建工具
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@bundlekit/service"><img src="https://img.shields.io/npm/v/@bundlekit/service.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@bundlekit/cli"><img src="https://img.shields.io/npm/v/@bundlekit/cli.svg" alt="npm version" /></a>
  <a href="https://github.com/Harhao/bundlekit/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@bundlekit/service.svg" alt="license" /></a>
  <a href="https://bundlekit.harhao.workers.dev"><img src="https://img.shields.io/badge/docs-online-blue" alt="docs" /></a>
</p>

---

## 简介

BundleKit 是一个**前端多构建器统一工具集**，目标是让开发者通过**一份 `.bundlekitrc.ts` 配置文件**，即可自由切换底层构建工具，无需关心各构建器之间配置的差异。

目前已支持的构建器包括：Webpack、Vite、Rollup、Rspack、Rolldown、Parcel、esbuild。

## 特性

- 🚀 **多构建器支持**：一套配置，支持切换 Webpack / Vite / Rollup / Rspack / Rolldown / Parcel / esbuild
- 🧩 **插件化架构**：通过插件扩展框架支持（React / Vue 3 / Svelte / Angular / Node.js）
- 🎯 **CLI 脚手架**：一行命令创建项目，交互式选择框架、构建器、语言
- 🔌 **插件管理**：为已有项目添加框架插件（`bundlekit-cli add`）
- 📦 **库模式**：支持 ESM / CJS / UMD 多格式输出（`--lib` / `--library-name`）
- 🖥️ **SSR 支持**：内置服务端渲染支持，双通道构建（`--ssr`）
- 🤖 **MCP 集成**：提供 MCP Server，支持通过 AI 工具链创建和管理项目
- 📖 **文档站点**：基于 dumi 的完整文档和贡献指南
- ✅ **完善的测试**：单元测试 + 集成测试 + E2E 测试

## 快速开始

### 创建新项目

```bash
# 使用完整命令
bundlekit-cli create my-app

# 或使用短别名
bc create my-app
```

创建过程中会交互式选择：

- 项目模板（框架 + 语言）
- 构建器
- 包管理器
- 是否启用 SSR
- 是否为库模式

### 为已有项目添加插件

```bash
bc add react
bc add vue
bc add svelte
bc add angular
bc add node
```

### 常用选项

```bash
# 跳过交互，直接指定参数
bc create my-app --template react-ts --bundler vite

# 创建 SSR 项目
bc create my-app --template vue3-ts --bundler vite --ssr

# 创建库项目
bc create my-lib --template node-ts --bundler rollup --lib --library-name MyLib
```

**可用模板**：`react-ts` `react-js` `vue3-ts` `vue3-js` `svelte-ts` `svelte-js` `angular-ts` `angular-js` `node-ts`

**可用构建器**：`vite` `webpack` `rspack` `rollup` `rolldown` `parcel` `esbuild`

**包管理器**：`npm` `yarn` `pnpm`（默认 pnpm）

## 配置说明

项目根目录创建 `.bundlekitrc.ts`（或 `.bundlekitrc.js`）文件：

```typescript
import { defineConfig } from '@bundlekit/service';

export default defineConfig({
  bundler: 'vite',
  plugins: ['react'],
  // SSR 配置（可选）
  ssr: {
    enabled: true,
  },
  // 开发环境配置
  dev: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  // 生产环境配置
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

## 使用构建服务

```bash
# 启动开发服务器
ds serve

# 生产构建
ds build
```

## MCP Server

BundleKit 提供了 MCP（Model Context Protocol）Server，可以通过 AI 工具链来创建和管理项目：

```bash
# 启动 MCP Server
bundlekit-cli-mcp
```

MCP Server 提供以下工具：

- `create-project` — 创建新项目
- `add-plugin` — 添加框架插件
- `list-templates` — 列出可用模板
- `help` — 获取帮助信息

适用于与支持 MCP 协议的 AI 助手集成，实现自然语言驱动的项目脚手架。

## 项目结构

```
bundlekit/
├── packages/
│   ├── bundlekit-cli/              # CLI 脚手架工具 (@bundlekit/cli)
│   ├── bundlekit-service/          # 构建服务 (@bundlekit/service)
│   ├── bundlekit-shared-utils/     # 共享工具库 (@bundlekit/shared-utils)
│   ├── bundlekit-cli-mcp/          # MCP Server (@bundlekit/cli-mcp)
│   ├── bundlekit-bundler-webpack/  # Webpack 适配器
│   ├── bundlekit-bundler-vite/     # Vite 适配器
│   ├── bundlekit-bundler-rollup/   # Rollup 适配器
│   ├── bundlekit-bundler-rspack/   # Rspack 适配器
│   ├── bundlekit-bundler-rolldown/ # Rolldown 适配器
│   ├── bundlekit-bundler-parcel/   # Parcel 适配器
│   ├── bundlekit-bundler-esbuild/  # esbuild 适配器
│   ├── bundlekit-plugin-react/     # React 框架插件
│   ├── bundlekit-plugin-vue/       # Vue 3 框架插件
│   ├── bundlekit-plugin-svelte/    # Svelte 框架插件
│   ├── bundlekit-plugin-angular/   # Angular 框架插件
│   ├── bundlekit-plugin-node/      # Node.js 插件
│   ├── bundlekit-plugin-mock/      # Mock API 插件
│   ├── bundlekit-request/          # HTTP 请求工具 (@bundlekit/request)
│   ├── bundlekit-docs/             # 文档站点 (dumi)
│   └── bundlekit-docs-agent/       # 文档查询 Agent
├── __tests__/                      # 测试目录
│   ├── unit/                       # 单元测试
│   └── integration/                # 集成测试 & E2E 测试
├── scripts/                        # 构建验证脚本
├── openspec/                       # AI Spec 配置
└── turbo.json                      # Turborepo 任务编排
```

## 包列表

| 包名 | npm 名 | 说明 |
|------|--------|------|
| `bundlekit-cli` | `@bundlekit/cli` | CLI 脚手架工具 |
| `bundlekit-service` | `@bundlekit/service` | 核心构建服务 |
| `bundlekit-shared-utils` | `@bundlekit/shared-utils` | 共享工具库 |
| `bundlekit-cli-mcp` | `@bundlekit/cli-mcp` | MCP Server |
| `bundlekit-bundler-webpack` | `@bundlekit/bundler-webpack` | Webpack 适配器 |
| `bundlekit-bundler-vite` | `@bundlekit/bundler-vite` | Vite 适配器 |
| `bundlekit-bundler-rollup` | `@bundlekit/bundler-rollup` | Rollup 适配器 |
| `bundlekit-bundler-rspack` | `@bundlekit/bundler-rspack` | Rspack 适配器 |
| `bundlekit-bundler-rolldown` | `@bundlekit/bundler-rolldown` | Rolldown 适配器 |
| `bundlekit-bundler-parcel` | `@bundlekit/bundler-parcel` | Parcel 适配器 |
| `bundlekit-bundler-esbuild` | `@bundlekit/bundler-esbuild` | esbuild 适配器 |
| `bundlekit-plugin-react` | `@bundlekit/plugin-react` | React 框架插件 |
| `bundlekit-plugin-vue` | `@bundlekit/plugin-vue` | Vue 3 框架插件 |
| `bundlekit-plugin-svelte` | `@bundlekit/plugin-svelte` | Svelte 框架插件 |
| `bundlekit-plugin-angular` | `@bundlekit/plugin-angular` | Angular 框架插件 |
| `bundlekit-plugin-node` | `@bundlekit/plugin-node` | Node.js / TypeScript 插件 |
| `bundlekit-plugin-mock` | `@bundlekit/plugin-mock` | Mock API 插件 |
| `bundlekit-request` | `@bundlekit/request` | HTTP 请求工具 |

## 开发

### 环境要求

- Node.js >= 20
- pnpm >= 8.15.9

### 安装依赖

```bash
pnpm install
```

### 构建

```bash
# 构建所有包
pnpm build:all

# 单独构建
pnpm build:shared      # 先构建共享工具
pnpm build:webpack     # 构建 webpack 适配器
pnpm build:vite        # 构建 vite 适配器
pnpm build:rollup      # 构建 rollup 适配器
pnpm build:rspack      # 构建 rspack 适配器
pnpm build:parcel      # 构建 parcel 适配器
pnpm build:esbuild     # 构建 esbuild 适配器
pnpm build:service     # 构建服务（依赖适配器）
pnpm build:docs        # 构建文档站点
```

### 测试

```bash
# 单元测试
pnpm test

# 集成测试
pnpm test:integration

# E2E 测试
pnpm test:e2e

# 全部测试
pnpm test:all
```

### 构建验证

```bash
# 验证包产物
pnpm verify:pack

# 验证模板完整性
node scripts/validate-templates.mjs
```

## 文档

文档站点源码位于 `packages/bundlekit-docs/`，基于 [dumi](https://d.umijs.org/) 构建。

```bash
# 本地启动文档站点
cd packages/bundlekit-docs
pnpm dev
```

在线文档：[bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

💬 **AI 文档助手**：[llm-chat-app.harhao.workers.dev](https://llm-chat-app.harhao.workers.dev) — 基于 RAG 的智能文档问答，支持自然语言查询 BundleKit 用法和配置

## 贡献指南

贡献文档位于 `packages/bundlekit-docs/docs/contributing/`，包含：

- [贡献总览](packages/bundlekit-docs/docs/contributing/index.md)
- [环境搭建](packages/bundlekit-docs/docs/contributing/setup.md)
- [测试指南](packages/bundlekit-docs/docs/contributing/testing.md)
- [发布流程](packages/bundlekit-docs/docs/contributing/release.md)
- [新增构建器](packages/bundlekit-docs/docs/contributing/adding-bundler.md)
- [新增插件](packages/bundlekit-docs/docs/contributing/adding-plugin.md)

## CI/CD

项目使用 GitHub Actions 自动化：

- **publish-npm**：推送 `master` 分支时自动构建、测试、发布 npm 包（Changesets）
- **create-release-pr**：自动创建版本发布 PR
- **deploy-docs**：自动部署文档站点

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Harhao/bundlekit&type=Date)](https://star-history.com/#Harhao/bundlekit&Date)

## 许可证

[MIT](./LICENSE) © [harhao](https://github.com/Harhao)
