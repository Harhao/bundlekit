---
title: 快速开始
order: 1
---

# 快速开始

bundlekit 是前端多打包器构建工具集，让你用一套配置驱动 Webpack、Vite、Rollup、Rspack、Rolldown、Parcel、esbuild 七种主流打包器。

## 你需要什么

- Node ≥ 18
- pnpm 8+（推荐） / npm / yarn 任选
- 现代终端（Windows 用户推荐 Windows Terminal / iTerm2）

## 路径选择

```
你想做什么？
├─ 创建新项目用 bundlekit              → 方式一：脚手架创建（用户路径）
├─ 给已有项目接入 bundlekit            → 方式二：现有项目接入
└─ 想给 bundlekit 本身贡献代码          → 方式三：本地 monorepo dev（贡献者路径）
```

## 方式一：脚手架创建（推荐）

> ⚠️ **`@bundlekit/*` 包目前正处于发版准备阶段，npm registry 上尚不可用**。在公开发布之前，请使用方式三在本地 monorepo 内创建项目。

发版后：

```bash
npm install -g @bundlekit/cli
bc create my-app
```

cli 会引导你完成以下步骤（TTY 终端使用 ink 渲染 banner + 步骤选择）：

1. 选择模板：`react-ts` / `react-js` / `vue3-ts` / `vue3-js`
2. 选择默认 bundler：`vite` / `webpack` / `rspack` / `rollup` / `rolldown` / `parcel` / `esbuild`
3. 输入项目描述（可选）
4. 选择包管理器：`pnpm`（推荐）/ `yarn` / `npm`

cli 会自动：

- 渲染模板到 `my-app/`
- 把所选 `@bundlekit/bundler-{name}` 写入新项目的 `devDependencies`
- 安装 `@bundlekit/service`、框架插件、选定的 bundler 等所有依赖
- 调用框架插件的 generator（如有）

完成后：

```bash
cd my-app
pnpm dev
```

> 在 CI / 非 TTY / 设置 `DEVKIT_NO_INK=1` 时，cli 自动回退到 enquirer + 行式日志路径，**功能等价**。

## 方式二：现有项目接入

```bash
# 1. 安装核心 + 选择的框架插件 + 选择的 bundler 适配器
pnpm add -D @bundlekit/service @bundlekit/plugin-react @bundlekit/bundler-vite

# 或用 bc add（推荐）：
pnpm add -D @bundlekit/cli
bc add react        # → @bundlekit/plugin-react
bc add bundler-vite # → @bundlekit/bundler-vite

# 2. 在项目根创建 .bundlekitrc.ts，参考 config 文档

# 3. package.json scripts 加：
#    "dev": "ds serve --bundler vite",
#    "build": "ds build --bundler vite --mode production"
```

## 全局安装 cli（可选）

```bash
pnpm add -g @bundlekit/cli
bc create my-app
```

## 方式三：本地 monorepo dev（贡献者路径）

如果你正在给 bundlekit 本身贡献代码，cli 会自动检测 monorepo 环境并用 `link:` 协议指向本地 `packages/`：

```bash
git clone https://github.com/Harhao/bundlekit.git
cd bundlekit
pnpm install
pnpm build:all

# 在 monorepo 内创建项目（自动 link 模式）
pnpm exec bc create my-demo -t react-ts -b vite --pm pnpm

# 生成的 my-demo/package.json 含：
#   "@bundlekit/service": "link:/abs/path/to/packages/bundlekit-service"
cd my-demo
pnpm install --ignore-workspace   # 秒级（仅装真实 npm 包）
pnpm dev                           # 立刻起 dev server
```

> 💡 详见 [贡献指南 → 环境搭建](/contributing/setup) 与 [贡献指南 → 发版流程](/contributing/release)。

## 项目结构

脚手架创建后的项目结构：

```
my-app/
├── .bundlekitrc.ts          # 构建配置文件
├── tsconfig.json         # TypeScript 配置
├── package.json          # 项目依赖（含 service + plugin + 选中的 bundler）
├── src/
│   ├── index.tsx         # 应用入口（CSR 模式，SSR 模式下不生成）
│   ├── entry-client.tsx  # SSR 客户端入口（仅 SSR 模式生成）
│   ├── entry-server.tsx  # SSR 服务端入口（仅 SSR 模式生成）
│   └── api/
│       └── index.ts      # HTTP 请求层（使用 @bundlekit/request）
├── public/
│   └── index.html        # HTML 模板
└── mock/
    └── db.json           # Mock 数据（供 plugin-mock 读取）
```

## 开发服务

```bash
# 默认（按 .bundlekitrc.ts 中的 bundler 字段）
pnpm dev

# 显式切换 bundler
ds serve --bundler vite
ds serve --bundler rspack
```

> 如果切换的 bundler 没有安装，service 会弹出 `未安装 @bundlekit/bundler-X，是否现在安装? (Y/n)` 提示。详见 [CLI 命令](/guide/cli)。

## 生产构建

```bash
pnpm build

# 或显式指定
ds build --bundler webpack --mode production
ds build --bundler vite --mode staging
```

## SSR 构建

bundlekit 7 个 bundler 都支持 build SSR 双产物（client + server）。在 `.bundlekitrc.ts` 加 `ssr` 字段即可：

```ts
config: {
  production: {
    entry: "src/entry-client.tsx",
    output: { dir: "dist/client", filename: "[name].js", formats: "esm" },
    ssr: {
      entry: "src/entry-server.tsx",
      output: { dir: "dist/server", filename: "server.cjs", formats: "commonjs" },
      externals: "auto",
    },
    // ...
  },
}
```

详见 [SSR 指南](/guide/ssr)。

## 跳过插件

```bash
ds serve --skip-plugin @bundlekit/plugin-mock
```

## 帮助信息

```bash
ds --help
bc --help
```

## 下一步

- [CLI 命令](/guide/cli) — `bc create` / `bc add` / `ds serve` / `ds build`
- [配置参考](/guide/config) — `.bundlekitrc.ts` 全字段（含 `tools` 逃生舱与 `ssr`）
- [打包器适配器](/guide/bundlers) — 7 个 bundler 的特性差异 + SSR 支持矩阵
- [SSR 指南](/guide/ssr) — 双产物构建 + dev SSR middleware
- [架构设计](/guide/architecture) — 模块依赖、设计原则
- [贡献指南](/contributing) — 环境搭建、运行测试、新增 bundler / plugin、发版流程
