---
title: 架构设计
order: 6
---

# 架构设计

本文介绍 bundle-devkit 的整体架构，帮助你理解各模块职责与数据流向。

## 整体结构

```
bundle-devkit/
├── packages/
│   ├── devkit-service          # 核心服务（命令调度 + 插件加载 + 打包器调度）
│   ├── devkit-cli              # 脚手架 CLI（create / add）
│   ├── devkit-shared-utils     # 公共类型、工具函数
│   ├── devkit-bundler-webpack  # ┐
│   ├── devkit-bundler-vite     # │ 各打包器适配器
│   ├── devkit-bundler-rollup   # │ 均实现 IBuildToolAdapter
│   ├── devkit-bundler-rspack   # │
│   ├── devkit-bundler-rolldown # ┘
│   ├── devkit-plugin-react     # ┐
│   ├── devkit-plugin-vue       # ├ 构建插件（写入 framework 字段）
│   ├── devkit-plugin-mock      # ┘
│   └── devkit-request          # 运行时 HTTP 客户端（axios / fetch）
└── docs/                       # 文档站（基于 dumi）
```

## 核心数据流

```
devkit-service serve/build
    │
    ├─① 解析配置
    │     ConfigLoader.loadDevkitFileConfig()  → 读取 .devkitrc.ts
    │     ConfigLoader.resolveAllConfig()      → 合并默认值、解析路径
    │     得到 IBuildConfig（抽象配置）
    │
    ├─② 加载插件
    │     Service.resolvePlugins()
    │       ├─ 内置插件：build / serve / help
    │       └─ 用户插件：读取 IBuildConfig.plugins[]，动态 import
    │
    ├─③ 执行插件 apply()
    │     每个插件调用 plugin.apply(api, buildConfig)
    │       └─ 框架插件（react/vue）向 buildConfig.config[env].framework 写入框架标识
    │
    ├─④ 调度打包器
    │     Service.startBuilder()
    │       ├─ 从注册表获取 bundler 适配器包名（静态配置）
    │       ├─ 动态 import 适配器
    │       ├─ adapter.transformConfig(IBuildConfig) → 各打包器原生配置
    │       ├─ Service.configureConfig()             → 用户 changeConfigure() 修改原生配置
    │       └─ adapter.run(nativeConfig)             → 启动开发服务或执行构建
    │
    └─⑤ 命令路由
          Service.commands[command].fn(args, rawArgv)
```

## 模块依赖关系

```
devkit-cli ──────────────────────────────► devkit-shared-utils
devkit-service ──────────────────────────► devkit-shared-utils
devkit-bundler-* ────────────────────────► devkit-shared-utils
devkit-plugin-* ─────────────────────────► devkit-shared-utils
devkit-request        （无 devkit 内部依赖，作为独立 npm 包）
```

`devkit-shared-utils` 是唯一的共享底层包，其他包只依赖它，彼此之间没有直接依赖，保证边界清晰。

## 关键类说明

### Service（`devkit-service/lib/Service.ts`）

核心协调器，负责整个服务生命周期：

| 方法 | 职责 |
|------|------|
| `run(command, args, rawArgv)` | 入口：初始化 → 分发命令 |
| `resolvePlugins()` | 加载内置插件 + 用户插件 |
| `init(mode, args)` | 解析配置、执行所有 plugin.apply() |
| `startBuilder()` | 加载打包器适配器，执行 transformConfig → run |
| `configureConfig(config)` | 调用用户 `changeConfigure` 回调，修改原生配置 |
| `loadBundlerPlugin(pkg)` | 动态 require/import 打包器适配器 |

### ConfigLoader（`devkit-service/lib/ConfigLoader.ts`）

负责配置文件的读取与处理：

- 使用 `jiti` 直接执行 TypeScript 配置文件，无需预编译
- `deepMerge(defaults, overrides)` 合并默认配置
- `resolvePaths(config)` 将相对路径转为绝对路径

### PluginAPI（`devkit-service/lib/PluginAPI.ts`）

插件与 Service 之间的桥接层，向插件暴露有限的 API 表面：

- `registerCommand()` — 注册自定义命令
- `modifyBuildConfig()` — 更新构建配置
- `addBuildPackage()` — 安装额外 npm 包
- `getCwd()` — 获取项目目录

### IBuildToolAdapter（`devkit-shared-utils`）

所有打包器适配器必须实现的接口：

```ts
interface IBuildToolAdapter<T = any> {
  name: string;
  transformConfig(config: IBuildConfig): T;       // 抽象配置 → 打包器原生配置
  validateConfig(config: T, buildConfig?: IBuildConfig): boolean;
  run(config: T): Promise<void>;                  // 启动构建或开发服务
}
```

## 构建依赖顺序（Turbo）

```
devkit-shared-utils
    ↓（被所有包依赖）
devkit-bundler-webpack
devkit-bundler-vite        （并行构建）
devkit-bundler-rollup
devkit-bundler-rspack
    ↓
devkit-service             （依赖所有 bundler 适配器）
```

`devkit-cli` 和 `devkit-request` 独立构建，不在此链路中。

## 设计原则

**1. 抽象配置与打包器解耦**
`.devkitrc.ts` 只描述意图（entry、output、框架类型），不包含任何打包器的具体配置。各适配器负责将抽象配置翻译成自身的原生格式。

**2. 插件只写字段，不感知打包器**
构建插件（如 plugin-react）只向 `buildConfig` 写入 `framework: "react"`，不直接修改 webpack/vite 配置。各打包器读取 `framework` 字段后自行处理，做到"一次声明，所有打包器生效"。

**3. 运行时动态加载打包器**
打包器适配器不预先打包进 service，而是在运行时按需 `require`/`import`，未安装时自动调用 `packageManager.add()` 安装，减少不必要的依赖体积。

**4. CLI 与 Service 完全分离**
`devkit-cli` 负责项目初始化，`devkit-service` 负责构建，二者通过 `.devkitrc.ts` 文件间接关联，互不依赖，可独立升级。
