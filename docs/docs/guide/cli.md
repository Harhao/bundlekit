---
title: CLI 命令
order: 3
---

# CLI 命令参考

devkit 提供两个 CLI 工具：`devkit-service` 用于构建，`devkit-cli` 用于项目脚手架。

## devkit-service

### serve — 开发服务

```bash
devkit-service serve [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--mode` | `string` | `development` | 构建环境 |
| `--bundler` | `string` | `webpack` | 打包器，可选 `vite` / `webpack` / `rollup` / `rspack` / `rolldown` |
| `--host` | `string` | `0.0.0.0` | 主机地址 |
| `--port` | `number` | `3000` | 端口号 |
| `--open` | `boolean` | `true` | 自动打开浏览器 |
| `--config` | `string` | `.devkitrc.ts` | 配置文件路径 |
| `--skip-plugin` | `string` | - | 跳过插件，逗号分隔 |

```bash
devkit-service serve
devkit-service serve --bundler vite --port 8080
devkit-service serve --bundler rspack --skip-plugin @devkit/plugin-mock
```

### build — 生产构建

```bash
devkit-service build [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--mode` | `string` | `production` | 构建环境 |
| `--bundler` | `string` | `webpack` | 打包器 |
| `--dest` | `string` | `dist` | 输出目录 |
| `--config` | `string` | `.devkitrc.ts` | 配置文件路径 |
| `--skip-plugin` | `string` | - | 跳过插件，逗号分隔 |

```bash
devkit-service build
devkit-service build --bundler vite --dest build
devkit-service build --bundler webpack --mode staging
```

---

## devkit-cli

### create — 创建项目

```bash
devkit-cli create <name> [options]
```

| 选项 | 类型 | 说明 |
|------|------|------|
| `-t, --template` | `string` | 模板类型，不传则交互选择 |
| `-b, --bundler` | `string` | 默认构建工具，不传则交互选择 |
| `-d, --description` | `string` | 项目描述 |

**支持模板：**

| 模板 | 说明 |
|------|------|
| `react-ts` | React 18 + TypeScript |
| `react-js` | React 18 + JavaScript |
| `vue3-ts` | Vue 3 + TypeScript + Composition API |
| `vue3-js` | Vue 3 + JavaScript + Composition API |

```bash
# 交互式模式（推荐）
devkit-cli create my-app

# 非交互模式
devkit-cli create my-app -t react-ts -b vite
devkit-cli create my-app -t vue3-ts -b vite
```

---

### add — 追加插件

向**已有项目**追加插件，遵循业界"安装 + 调用 generator"两步规范。

```bash
devkit-cli add <plugin>
```

**支持短名和全名：**

| 输入 | 解析为 | 类型 |
|------|--------|------|
| `mock` | `@devkit/plugin-mock` | 构建插件 |
| `react` | `@devkit/plugin-react` | 构建插件 |
| `vue` | `@devkit/plugin-vue` | 构建插件 |
| `request` | `@devkit/request` | 运行时库 |
| `@devkit/plugin-mock` | `@devkit/plugin-mock` | 构建插件 |

**执行流程：**

```
devkit-cli add react
    ↓ 解析包名 → @devkit/plugin-react
    ↓ 判断类型：含 plugin- → 构建插件（devDependency）
    ↓ pnpm add -D @devkit/plugin-react
    ↓ 构建 IGeneratorAPI（Enquirer 驱动）
    ↓ 查找 @devkit/plugin-react/generator
    ↓ generate(context, api)
         ↓ 写入 .devkitrc.ts → plugins: ["@devkit/plugin-react"]
         ↓ api.prompt() → "是否同时安装 @devkit/request？"
              y → pnpm add @devkit/request
              N → 跳过
```

**`IGeneratorAPI` 接口：** generator 通过此接口与 CLI 交互，不依赖任何具体提示库：

```ts
interface IGeneratorAPI {
  prompt<T>(questions: any[]): Promise<T>;  // Enquirer 驱动
  log(message: string): void;
}
```

**构建插件 vs 运行时库：**

- **构建插件**（`plugin-*`）：安装为 `devDependency`，generator 自动更新 `.devkitrc.ts` `plugins[]`
- **运行时库**（无 `plugin-` 前缀）：安装为 `dependency`，无 generator，在业务代码中 `import` 使用

```bash
devkit-cli add mock       # 追加 mock 构建插件
devkit-cli add vue        # 追加 vue 构建插件
devkit-cli add request    # 追加 @devkit/request 运行时库
```

---

### version — 查看版本

```bash
devkit-cli version
devkit-cli -v
```
