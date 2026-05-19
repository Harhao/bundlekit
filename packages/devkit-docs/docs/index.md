---
title: bundle-devkit
hero:
  title: bundle-devkit
  description: 前端多打包器构建工具集，一套配置运行 Webpack / Vite / Rollup / Rspack / Rolldown
  actions:
    - text: 快速开始
      link: /guide
    - text: 配置参考
      link: /guide/config
features:
  - title: 多打包器统一接口
    emoji: 🔧
    description: 支持 Webpack 5、Vite、Rollup 4、Rspack、Rolldown 五种主流打包器，使用同一套 .devkitrc.ts 配置文件，一套代码多打包器构建

  - title: 框架感知插件系统
    emoji: 🔌
    description: 构建插件（plugin-react / plugin-vue / plugin-mock）写入 framework 字段，各打包器自动加载对应 loader / 插件，无需手动配置

  - title: CLI 脚手架
    emoji: 🚀
    description: devkit-cli 提供 create 创建项目、add 追加插件两个命令。add 命令遵循业界规范，安装包后自动调用插件内置 generator 更新配置

  - title: 统一配置驱动
    emoji: 📋
    description: 通过 .devkitrc.ts 集中管理多环境构建配置（development / production / test / staging / gray），一次配置处处生效

  - title: 运行时打包器切换
    emoji: ⚡
    description: 通过 --bundler 参数动态切换打包器，无需修改配置，开发 / 构建灵活自如

  - title: 运行时 HTTP 库
    emoji: 🌐
    description: "@devkit/request 提供 axios / fetch 双引擎 HTTP 客户端，统一 API、支持拦截器，作为普通 npm 包安装使用"
---

## 安装

```bash
# 使用 pnpm（推荐）
pnpm add -D @devkit/service @devkit/cli
```

## 快速试用

```bash
# 创建项目
npx devkit-cli create my-app

# 进入项目后追加插件
cd my-app
devkit-cli add mock

# 启动开发服务
npx devkit-service serve --bundler vite

# 生产构建
npx devkit-service build --bundler webpack --mode production
```
