---
title: 快速开始
order: 1
---

# 快速开始

bundle-devkit 是前端多打包器构建工具集，让你用一套配置驱动 Webpack、Vite、Rollup、Rspack、Rolldown 五种主流打包器。

## 安装

确保 `node >= 18.0.0`，推荐使用 `pnpm`：

```bash
pnpm add -D @devkit/service @devkit/cli
```

## 创建项目

使用 CLI 脚手架从模板创建新项目：

```bash
# 交互式模式（推荐）
devkit-cli create my-app

# 指定模板和构建工具
devkit-cli create my-app --template react-ts --bundler vite
devkit-cli create my-app --template vue3-ts --bundler vite
devkit-cli create my-app --template react-js --bundler webpack
```

## 追加插件

项目创建后，使用 `add` 命令向已有项目追加插件：

```bash
# 追加构建插件（自动写入 .devkitrc.ts plugins[]）
devkit-cli add mock
devkit-cli add vue

# 追加运行时库（写入 package.json dependencies）
devkit-cli add request
```

## 项目结构

创建后的项目结构：

```
my-app/
├── .devkitrc.ts          # 构建配置文件
├── tsconfig.json         # TypeScript 配置
├── package.json          # 项目依赖与脚本
├── src/
│   ├── index.tsx         # 应用入口
│   └── api/
│       └── index.ts      # HTTP 请求层（使用 @devkit/request）
├── public/
│   └── index.html        # HTML 模板
└── mock/
    └── db.json           # Mock 数据（供 plugin-mock 读取）
```

## 开发服务

```bash
# 使用 Vite 启动开发服务（默认端口 3000）
devkit-service serve --bundler vite

# 使用 Webpack 启动开发服务
devkit-service serve --bundler webpack

# 使用 Rspack 启动开发服务（Rust 实现，极速）
devkit-service serve --bundler rspack
```

## 生产构建

```bash
# Webpack 生产构建
devkit-service build --bundler webpack --mode production

# Vite 生产构建
devkit-service build --bundler vite --mode production

# 多环境构建
devkit-service build --bundler webpack --mode staging
devkit-service build --bundler webpack --mode gray
```

## 跳过插件

```bash
devkit-service serve --skip-plugin @devkit/plugin-mock
```

## 帮助信息

```bash
devkit-service --help
devkit-cli --help
```
