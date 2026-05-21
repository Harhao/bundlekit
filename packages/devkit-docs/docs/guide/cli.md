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
# 缩写
ds serve [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--mode` | `string` | `development` | 构建环境 |
| `--bundler` | `string` | `webpack` | 打包器，可选 `vite` / `webpack` / `rollup` / `rspack` / `rolldown` |
| `--host` | `string` | `0.0.0.0` | 主机地址 |
| `--port` | `number` | `3000` | 端口号 |
| `--open` | `boolean` | `false` | 自动打开浏览器 |
| `--skip-plugin` | `string` | - | 跳过插件，逗号分隔 |
| `--stdin` | `boolean` | - | stdin 关闭时自动退出服务进程 |

> 配置文件路径固定为项目根目录下的 `.devkitrc.ts` 或 `.devkitrc.js`，不支持 `--config` 参数指定。

```bash
devkit-service serve
devkit-service serve --bundler vite --port 8080
devkit-service serve --bundler rspack --skip-plugin @devkit/plugin-mock
```

#### 运行时缺失 bundler 行为

当 `--bundler` 指向的适配器（`@devkit/bundler-{name}`）未安装时：

- **TTY 交互环境**：弹出 `未安装 @devkit/bundler-X，是否现在安装? (Y/n)`
  - 选 `y` → 装入 `devDependencies` 并继续
  - 选 `n` → 报错退出，提示运行 `devkit-cli add bundler-X`
- **CI / 非 TTY 环境**：默认不 prompt，直接报错退出

环境变量旁路：

| 变量 | 含义 |
|---|---|
| `DEVKIT_NO_PROMPT=1` | 即使在 TTY 也不弹 prompt |
| `DEVKIT_AUTO_INSTALL=1` | 非 TTY 自动装入 `devDependencies` |

### build — 生产构建

```bash
devkit-service build [options]
# 缩写
ds build [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--mode` | `string` | `production` | 构建环境 |
| `--bundler` | `string` | `webpack` | 打包器 |
| `--watch` | `boolean` | - | watch 模式，文件变化时自动重构建 |
| `--skip-plugins` | `string` | - | 跳过插件，逗号分隔（注意：复数形式） |

> 输出目录通过 `.devkitrc.ts` 中 `config[env].output.dir` 字段配置，不支持 `--dest` 参数覆盖。

```bash
devkit-service build
devkit-service build --bundler vite
devkit-service build --bundler webpack --mode staging
devkit-service build --bundler rollup --watch
```

---

## devkit-cli

> 缩写命令：`dc`（等同于 `devkit-cli`）

> **CLI 视觉**：在 TTY 终端中，cli 使用 [ink](https://github.com/vadimdemedes/ink) 渲染步骤式交互界面（gradient banner、SelectInput、TaskList、Done view）。
> 在 CI / 非 TTY 环境，或设置 `DEVKIT_NO_INK=1` 时自动回退到 enquirer + Logger 行式输出，**功能等价**。
>
> Windows 用户推荐使用 Windows Terminal / iTerm2 等现代终端获得最佳体验。

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

### add — 追加插件 / 适配器

向**已有项目**追加插件或 bundler 适配器，遵循"安装 + 调用 generator"两步规范。

```bash
devkit-cli add <name>
```

**支持短名和全名（构建插件）：**

| 输入 | 解析为 | 类型 |
|------|--------|------|
| `mock` | `@devkit/plugin-mock` | 构建插件 |
| `react` | `@devkit/plugin-react` | 构建插件 |
| `vue` | `@devkit/plugin-vue` | 构建插件 |
| `request` | `@devkit/request` | 运行时库 |
| `@devkit/plugin-mock` | `@devkit/plugin-mock` | 构建插件 |

**支持短名和全名（bundler 适配器）：**

| 输入 | 解析为 | 类型 |
|------|--------|------|
| `vite` | `@devkit/bundler-vite` | 构建工具适配器 |
| `webpack` | `@devkit/bundler-webpack` | 构建工具适配器 |
| `rspack` | `@devkit/bundler-rspack` | 构建工具适配器 |
| `rollup` | `@devkit/bundler-rollup` | 构建工具适配器 |
| `rolldown` | `@devkit/bundler-rolldown` | 构建工具适配器 |
| `bundler-vite` | `@devkit/bundler-vite` | 构建工具适配器 |
| `@devkit/bundler-vite` | `@devkit/bundler-vite` | 构建工具适配器 |

> bundler 适配器统一安装为 `devDependency`，**不**触发 generator 流程。

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
