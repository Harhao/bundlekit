# bundle-devkit

[English](#english) | [中文](#chinese)

---

<a name="chinese"></a>

## 中文

前端多打包器构建工具集 —— 一套 `.devkitrc.ts` 配置，驱动 Webpack / Vite / Rollup / Rspack / Rolldown 五种主流打包器。

### 架构概览

```
.devkitrc.ts
    ↓ ConfigLoader 解析
IBuildConfig（抽象配置）
    ↓ Plugin.apply() 注入框架信息（framework 字段）
    ↓ BundlerAdapter.transformConfig()
各打包器原生配置
    ↓ BundlerAdapter.run()
构建产物
```

**核心包说明：**

| 包名 | 说明 |
|------|------|
| `@devkit/service` | 核心服务，负责插件加载、配置解析、打包器调度 |
| `@devkit/cli` | 脚手架工具，提供 `create` 与 `add` 命令 |
| `@devkit/shared-utils` | 公共工具与类型定义 |
| `@devkit/bundler-webpack` | Webpack 5 适配器 |
| `@devkit/bundler-vite` | Vite 适配器 |
| `@devkit/bundler-rollup` | Rollup 4 适配器 |
| `@devkit/bundler-rspack` | Rspack 适配器（Rust 实现，极速） |
| `@devkit/bundler-rolldown` | Rolldown 适配器（实验性） |
| `@devkit/plugin-react` | React 构建插件 |
| `@devkit/plugin-vue` | Vue 3 构建插件 |
| `@devkit/plugin-mock` | Mock API 插件 |
| `@devkit/request` | 运行时 HTTP 客户端（axios / fetch 双引擎） |

### 安装

确保 `node >= 18.0.0`，推荐使用 `pnpm`。

#### 方式一：脚手架创建（推荐）

```bash
npx @devkit/cli create my-app
```

cli 会引导你选择模板与 bundler，并自动安装 `@devkit/service` + 框架插件 + 你选择的 bundler 适配器到新项目。

#### 方式二：现有项目接入

```bash
pnpm add -D @devkit/service @devkit/plugin-react @devkit/bundler-vite
```

或：

```bash
pnpm add -D @devkit/cli
dc add react
dc add bundler-vite
```

### 快速开始

```bash
# 创建项目（交互式）
devkit-cli create my-app

# 指定模板和打包器
devkit-cli create my-app --template react-ts --bundler vite

# 追加插件
devkit-cli add mock

# 启动开发服务
npx devkit-service serve --bundler vite

# 生产构建
npx devkit-service build --bundler webpack --mode production
```

### 运行时切换打包器

无需修改配置，`--bundler` 参数即可切换：

```bash
devkit-service serve --bundler rspack    # Rust 实现，冷启动极速
devkit-service build --bundler rollup    # 适合库打包
```

### 配置文件示例

```ts
// .devkitrc.ts
import type { IBuildConfig } from "@devkit/shared-utils";

const config: IBuildConfig = {
  bundler: "vite",
  plugins: ["@devkit/plugin-react"],
  config: {
    development: {
      entry: "src/index.tsx",
      output: { dir: "dist", filename: "[name].js", formats: "umd" },
      devServer: { host: "0.0.0.0", port: 3000 },
    },
    production: {
      entry: "src/index.tsx",
      output: { dir: "dist", filename: "[name].[contenthash:8].js", formats: "umd" },
      js: { minify: true },
    },
  },
};

export default config;
```

### Monorepo 构建

```bash
# 构建所有包（按依赖顺序）
pnpm build:service

# 单独构建
pnpm build:shared    # shared-utils
pnpm build:webpack   # bundler-webpack
pnpm build:vite      # bundler-vite
pnpm build:rollup    # bundler-rollup
pnpm build:rspack    # bundler-rspack
```

### 文档

详细文档请访问 `docs/` 目录或运行本地文档站：

```bash
cd docs
pnpm install && pnpm start
```

---

<a name="english"></a>

## English

A frontend multi-bundler toolkit — one `.devkitrc.ts` config drives Webpack / Vite / Rollup / Rspack / Rolldown.

### Architecture

```
.devkitrc.ts
    ↓ ConfigLoader parses config
IBuildConfig (abstract config)
    ↓ Plugin.apply() injects framework info
    ↓ BundlerAdapter.transformConfig()
Bundler-native config
    ↓ BundlerAdapter.run()
Build output
```

**Packages:**

| Package | Description |
|---------|-------------|
| `@devkit/service` | Core service: plugin loading, config resolution, bundler dispatch |
| `@devkit/cli` | CLI scaffold with `create` and `add` commands |
| `@devkit/shared-utils` | Shared utilities and type definitions |
| `@devkit/bundler-webpack` | Webpack 5 adapter |
| `@devkit/bundler-vite` | Vite adapter |
| `@devkit/bundler-rollup` | Rollup 4 adapter |
| `@devkit/bundler-rspack` | Rspack adapter (Rust-based, ultra-fast) |
| `@devkit/bundler-rolldown` | Rolldown adapter (experimental) |
| `@devkit/plugin-react` | React build plugin |
| `@devkit/plugin-vue` | Vue 3 build plugin |
| `@devkit/plugin-mock` | Mock API plugin |
| `@devkit/request` | Runtime HTTP client (axios / fetch dual engine) |

### Installation

Requires `node >= 18.0.0`. `pnpm` is recommended.

#### Option 1: scaffold (recommended)

```bash
npx @devkit/cli create my-app
```

The cli interactively picks a template and bundler, then installs `@devkit/service` + framework plugin + the chosen bundler adapter into the new project.

#### Option 2: manual integration

```bash
pnpm add -D @devkit/service @devkit/plugin-react @devkit/bundler-vite
```

### Quick Start

```bash
# Create a project (interactive)
devkit-cli create my-app

# Specify template and bundler
devkit-cli create my-app --template react-ts --bundler vite

# Add a plugin
devkit-cli add mock

# Start dev server
npx devkit-service serve --bundler vite

# Production build
npx devkit-service build --bundler webpack --mode production
```

### Switch Bundler at Runtime

No config changes needed — just pass `--bundler`:

```bash
devkit-service serve --bundler rspack    # Rust-based, ultra-fast cold start
devkit-service build --bundler rollup    # Great for library builds
```

### Config Example

```ts
// .devkitrc.ts
import type { IBuildConfig } from "@devkit/shared-utils";

const config: IBuildConfig = {
  bundler: "vite",
  plugins: ["@devkit/plugin-react"],
  config: {
    development: {
      entry: "src/index.tsx",
      output: { dir: "dist", filename: "[name].js", formats: "umd" },
      devServer: { host: "0.0.0.0", port: 3000 },
    },
    production: {
      entry: "src/index.tsx",
      output: { dir: "dist", filename: "[name].[contenthash:8].js", formats: "umd" },
      js: { minify: true },
    },
  },
};

export default config;
```

### Monorepo Build

```bash
# Build all packages (dependency order handled by Turbo)
pnpm build:service

# Build individually
pnpm build:shared    # shared-utils
pnpm build:webpack   # bundler-webpack
pnpm build:vite      # bundler-vite
pnpm build:rollup    # bundler-rollup
pnpm build:rspack    # bundler-rspack
```

### Documentation

See the `docs/` directory or run the local docs site:

```bash
cd docs
pnpm install && pnpm start
```

### License

MIT
