---
title: CLI 命令
order: 3
---

# CLI 命令参考

bundlekit 提供两个 CLI 工具：`bundlekit-service` 用于构建，`bundlekit-cli` 用于项目脚手架。

## bundlekit-service

### serve — 开发服务

```bash
bundlekit-service serve [options]
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

> 配置文件路径固定为项目根目录下的 `.bundlekitrc.ts` 或 `.bundlekitrc.js`，不支持 `--config` 参数指定。

```bash
bundlekit-service serve
bundlekit-service serve --bundler vite --port 8080
bundlekit-service serve --bundler rspack --skip-plugin @bundlekit/plugin-mock
```

#### 运行时缺失 bundler 行为

当 `--bundler` 指向的适配器（`@bundlekit/bundler-{name}`）未安装时：

- **TTY 交互环境**：弹出 `未安装 @bundlekit/bundler-X，是否现在安装? (Y/n)`
  - 选 `y` → 装入 `devDependencies` 并继续
  - 选 `n` → 报错退出，提示运行 `bundlekit-cli add bundler-X`
- **CI / 非 TTY 环境**：默认不 prompt，直接报错退出

环境变量旁路：

| 变量 | 含义 |
|---|---|
| `DEVKIT_NO_PROMPT=1` | 即使在 TTY 也不弹 prompt |
| `DEVKIT_AUTO_INSTALL=1` | 非 TTY 自动装入 `devDependencies` |

### build — 生产构建

```bash
bundlekit-service build [options]
# 缩写
ds build [options]
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--mode` | `string` | `production` | 构建环境 |
| `--bundler` | `string` | `webpack` | 打包器 |
| `--watch` | `boolean` | - | watch 模式，文件变化时自动重构建 |
| `--skip-plugins` | `string` | - | 跳过插件，逗号分隔（注意：复数形式） |

> 输出目录通过 `.bundlekitrc.ts` 中 `config[env].output.dir` 字段配置，不支持 `--dest` 参数覆盖。

```bash
bundlekit-service build
bundlekit-service build --bundler vite
bundlekit-service build --bundler webpack --mode staging
bundlekit-service build --bundler rollup --watch
```

---

## bundlekit-cli

> 缩写命令：`dc`（等同于 `bundlekit-cli`）

> **CLI 视觉**：在 TTY 终端中，cli 使用 [ink](https://github.com/vadimdemedes/ink) 渲染步骤式交互界面（gradient banner、SelectInput、TaskList、Done view）。
> 在 CI / 非 TTY 环境，或设置 `DEVKIT_NO_INK=1` 时自动回退到 enquirer + Logger 行式输出，**功能等价**。
>
> Windows 用户推荐使用 Windows Terminal / iTerm2 等现代终端获得最佳体验。

### create — 创建项目

```bash
bundlekit-cli create <name> [options]
```

| 选项 | 类型 | 说明 |
|------|------|------|
| `-t, --template` | `string` | 模板类型，不传则交互选择 |
| `-b, --bundler` | `string` | 默认构建工具，不传则交互选择 |
| `-d, --description` | `string` | 项目描述 |
| `--pm` | `string` | 包管理器（`pnpm` / `yarn` / `npm`），不传则交互选择 |
| `--ssr` | `boolean` | 生成 SSR 骨架（含 `entry-client` / `entry-server` + `<!--ssr-outlet-->` 占位） |

**支持模板：**

| 模板 | 说明 |
|------|------|
| `react-ts` | React 18 + TypeScript |
| `react-js` | React 18 + JavaScript |
| `vue3-ts` | Vue 3 + TypeScript + Composition API |
| `vue3-js` | Vue 3 + JavaScript + Composition API |

```bash
# 交互式模式（推荐）
bundlekit-cli create my-app

# 非交互模式
bundlekit-cli create my-app -t react-ts -b vite
bundlekit-cli create my-app -t vue3-ts -b vite

# 指定包管理器
bundlekit-cli create my-app -t react-ts -b vite --pm pnpm

# 生成 SSR 骨架
bundlekit-cli create my-app -t react-ts -b vite --ssr
```

#### 环境变量

| 变量 | 值 | 说明 |
|------|-----|------|
| `DEVKIT_NO_INK` | `1` | 强制回退到 enquirer + 行式输出（非 TTY 自动启用） |
| `DEVKIT_NO_PROMPT` | `1` | 跳过所有 generator 交互提示（CI 自动注入，或在 `dc create` 非 TTY 路径下自动生效） |
| `DEVKIT_SKIP_INSTALL` | `1` | 跳过依赖安装步骤（生成文件后直接退出，适合调试模板） |
| `DEVKIT_PM` | `pnpm\|yarn\|npm` | 强制使用指定包管理器（等价 `--pm`，优先级低于 CLI 参数） |
| `DEVKIT_DEP_MODE` | `link\|npm` | 强制依赖模式：`link` 写本地 `link:` 路径，`npm` 写 `^cliVersion` |
| `DEVKIT_MONOREPO_ROOT` | 路径 | 手动指定 monorepo 根目录（覆盖自动检测） |
| `DEVKIT_AUTO_INSTALL` | `1` | 非 TTY / CI 环境自动安装缺失 bundler（等价 `dc add` 后自动 install） |
| `DEVKIT_QUIET` | `1` | Logger 静默（只输出 WARN/ERROR 及以上） |
| `DEVKIT_DEBUG` | `1` | 输出 DEBUG 级日志（二进制镜像探测、workspace 检测等噪音级信息） |

---

### add — 追加插件 / 适配器

向**已有项目**追加插件或 bundler 适配器，遵循"安装 + 调用 generator"两步规范。

```bash
bundlekit-cli add <name>
```

**支持短名和全名（构建插件）：**

| 输入 | 解析为 | 类型 |
|------|--------|------|
| `mock` | `@bundlekit/plugin-mock` | 构建插件 |
| `react` | `@bundlekit/plugin-react` | 构建插件 |
| `vue` | `@bundlekit/plugin-vue` | 构建插件 |
| `request` | `@bundlekit/request` | 运行时库 |
| `@bundlekit/plugin-mock` | `@bundlekit/plugin-mock` | 构建插件 |

**支持短名和全名（bundler 适配器）：**

| 输入 | 解析为 | 类型 |
|------|--------|------|
| `vite` | `@bundlekit/bundler-vite` | 构建工具适配器 |
| `webpack` | `@bundlekit/bundler-webpack` | 构建工具适配器 |
| `rspack` | `@bundlekit/bundler-rspack` | 构建工具适配器 |
| `rollup` | `@bundlekit/bundler-rollup` | 构建工具适配器 |
| `rolldown` | `@bundlekit/bundler-rolldown` | 构建工具适配器 |
| `bundler-vite` | `@bundlekit/bundler-vite` | 构建工具适配器 |
| `@bundlekit/bundler-vite` | `@bundlekit/bundler-vite` | 构建工具适配器 |

> bundler 适配器统一安装为 `devDependency`，**不**触发 generator 流程。

**执行流程：**

```
bundlekit-cli add react
    ↓ 解析包名 → @bundlekit/plugin-react
    ↓ 判断类型：含 plugin- → 构建插件（devDependency）
    ↓ pnpm add -D @bundlekit/plugin-react
    ↓ 构建 IGeneratorAPI（Enquirer 驱动）
    ↓ 查找 @bundlekit/plugin-react/generator
    ↓ generate(context, api)
         ↓ 写入 .bundlekitrc.ts → plugins: ["@bundlekit/plugin-react"]
         ↓ api.prompt() → "是否同时安装 @bundlekit/request？"
              y → pnpm add @bundlekit/request
              N → 跳过
```

> **TTY 检测**：generator 内的 `api.prompt()` 只在真实 TTY 下展示，当检测到 `!process.stdout.isTTY`、`DEVKIT_NO_PROMPT=1` 或 `CI=true|1` 时自动跳过（使用默认值 `false`）。`dc create` 命令在 ink 渲染路径下会自动注入 `DEVKIT_NO_PROMPT=1`，确保创建流程不会因 generator prompt 阻塞。`dc add` 命令保留交互（面向已有项目主动追加场景）。

**`IGeneratorAPI` 接口：** generator 通过此接口与 CLI 交互，不依赖任何具体提示库：

```ts
interface IGeneratorAPI {
  prompt<T>(questions: any[]): Promise<T>;  // Enquirer 驱动
  log(message: string): void;
}
```

**构建插件 vs 运行时库：**

- **构建插件**（`plugin-*`）：安装为 `devDependency`，generator 自动更新 `.bundlekitrc.ts` `plugins[]`
- **运行时库**（无 `plugin-` 前缀）：安装为 `dependency`，无 generator，在业务代码中 `import` 使用

```bash
bundlekit-cli add mock       # 追加 mock 构建插件
bundlekit-cli add vue        # 追加 vue 构建插件
bundlekit-cli add request    # 追加 @bundlekit/request 运行时库
```

---

### version — 查看版本

```bash
bundlekit-cli version
bundlekit-cli -v
```

---

## FAQ

### Q: 为什么生成的 `package.json` 含 `link:/abs/path` 形式的依赖？

cli 检测到当前 cwd 在 bundle-bundlekit 的 monorepo 内（contributors 调试场景），会自动把模板里的 `workspace:^` 协议替换为 `link:` 绝对路径，让 `pnpm install --ignore-workspace` 秒级跑通。

如果你不在 monorepo 内（外部用户）：

```json
"@bundlekit/service": "^0.1.0"   // 自动从 cli 自身版本推导
```

强制走 npm 模式（用于测试）：

```bash
DEVKIT_DEP_MODE=npm dc create my-app -t react-ts
```

### Q: `link:` 模式生成的项目能复制到别的机器吗？

**不能**。`link:` 是绝对路径，只在生成时所在的机器上有效。复制到别的机器后 `pnpm install` 会报路径不存在。

如果要分享给同事，让他们也 clone monorepo 后跑 `dc create`，或等 `@bundlekit/*` 发到 npm 后用全局 cli 创建。

### Q: 我把生成的项目作为 git 仓库提交，`link:` 路径会泄露吗？

会。绝对路径包含 `/Users/<你的用户名>/...`。两个解法：

1. 等 npm 发版后切回 npm 模式（删 `link:` 改 `^x.y.z`）
2. 在 monorepo 外创建项目：`cd /tmp && pnpm exec /path/to/cli/bin create demo`，但仍然会有 `^cliVersion` 但包未发布

### Q: cli 创建项目时卡在 install

最常见原因：`@bundlekit/*` 还未发布到 npm registry，且你不在 monorepo 内。

```bash
# 临时绕过：跳过 install
DEVKIT_SKIP_INSTALL=1 dc create my-app
# 之后等发版了再 cd my-app && pnpm install

# 或者：在 monorepo 内跑（自动 link 模式）
cd /path/to/bundle-bundlekit
pnpm exec dc create my-app
```

### Q: 如何修改生成项目的依赖范围

cli 创建后你拿到一个普通 npm 项目，依赖完全可改：

```bash
cd my-app
# 升级
pnpm update @bundlekit/service

# 锁版本
pnpm install @bundlekit/service@0.1.5
```

### Q: `dc create` 时 generator 追问是否安装额外包的提示没有出现

这是正常行为。`dc create`（ink 渲染路径）在调用框架 generator 前会自动注入 `DEVKIT_NO_PROMPT=1`，跳过所有交互式提问，使用默认值（不安装）。如果你想手动触发 generator 提问，切换到 `dc add` 命令：

```bash
# dc add 保留交互
dc add react    # 会弹出"是否安装 @bundlekit/request？"
```

或者直接手工安装：

```bash
cd my-app && pnpm add @bundlekit/request
```
