---
title: bundlekit
hero:
  title: bundlekit
  description: 前端多打包器构建工具集，一套配置运行 Webpack / Vite / Rollup / Rspack / Rolldown / Parcel / esbuild
  actions:
    - text: 快速开始
      link: /guide
    - text: 配置参考
      link: /guide/config
features:
  - title: 多打包器统一接口
    emoji: 🔧
    description: 支持 Webpack 5、Vite、Rollup 4、Rspack、Rolldown、Parcel 2、esbuild 七种主流打包器，使用同一套 .bundlekitrc.ts 配置文件，一套代码多打包器构建

  - title: 框架感知插件系统
    emoji: 🔌
    description: 构建插件（plugin-react / plugin-vue / plugin-node / plugin-mock）写入 framework 字段，各打包器自动加载对应 loader / 插件，无需手动配置

  - title: CLI 脚手架（ink 美化）
    emoji: 🚀
    description: bundlekit-cli 提供 create / add 两条命令，TTY 终端用 ink 渲染 banner + 步骤式表单，CI 自动回退到行式输出

  - title: 统一配置驱动 + 逃生舱
    emoji: 📋
    description: 通过 .bundlekitrc.ts 集中管理多环境构建配置；当 bundler 抽象不够用时，tools.{bundler} 钩子直接拿到原生 config 进行扩展

  - title: 运行时打包器切换
    emoji: ⚡
    description: 通过 --bundler 参数动态切换打包器，service 在缺失 bundler 时弹出 yes/no 安装提示，CI 友好

  - title: SSR 全 bundler 支持
    emoji: 🌐
    description: 7 个 bundler 都支持 build SSR 双产物（client + server）；vite 提供原生 dev SSR middleware

  - title: AI Agent 友好
    emoji: 🤖
    description: 内置 @bundlekit/cli-mcp（MCP server，把 create / add 暴露给 Cursor / Claude / Windsurf）+ @bundlekit/docs-agent（Cloudflare Worker 文档 RAG agent）
---

## 安装与上手

最简单的方式是通过脚手架直接创建项目：

```bash
npx @bundlekit/cli create my-app
```

cli 会引导你选择模板和 bundler，创建后自动安装 `@bundlekit/service` + 框架插件 + 你选择的 bundler 适配器。

## 快速试用

```bash
# 创建项目（推荐）
npx @bundlekit/cli create my-app

# 进入项目后追加插件 / bundler
cd my-app
bc add mock
bc add bundler-rspack

# 启动开发服务
pnpm dev

# 生产构建
pnpm build
```

更详细的两条集成路径（脚手架 / 已有项目接入）参见[快速开始](/guide)。
