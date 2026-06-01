---
title: 环境搭建
order: 2
---

# 环境搭建

## 前置要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 18 | ESM 默认支持 + 原生 fetch |
| pnpm | ≥ 8.15.9 | monorepo 必须用 pnpm（workspace 协议依赖） |
| Git | 任意 | clone + 提交 |
| Chromium | 可选 | 仅跑 Playwright e2e 测试时需要 |

强烈推荐用 [Volta](https://volta.sh/) 或 [fnm](https://github.com/Schniz/fnm) 管理 Node 版本。

## 克隆与安装

```bash
git clone https://github.com/Harhao/bundlekit.git
cd bundlekit

# 装所有 workspace 依赖（约 1-2 分钟）
pnpm install
```

## 构建所有包

```bash
# 一键构建所有 @bundlekit/* 包
pnpm build:all

# 或者按需构建单个包
pnpm --filter @bundlekit/cli run cli:build
pnpm --filter @bundlekit/service run service:build
pnpm --filter @bundlekit/shared-utils run shared:build
pnpm --filter @bundlekit/bundler-vite run vite:build
pnpm --filter @bundlekit/bundler-webpack run webpack:build
pnpm --filter @bundlekit/bundler-rspack run rspack:build
pnpm --filter @bundlekit/bundler-rollup run rollup:build
pnpm --filter @bundlekit/bundler-rolldown run rolldown:build
```

构建产物输出到各包的 `dist/` 目录。

## monorepo 内 cli 调试

cli 检测到 monorepo 后会自动用 `link:` 协议指向本地 `packages/`，秒级 install：

```bash
# 在 monorepo 根目录跑
pnpm exec bc create my-demo -t react-ts -b vite --pm pnpm

# 生成的项目 package.json 含：
#   "@bundlekit/service": "link:/abs/path/to/packages/bundlekit-service"
# pnpm install --ignore-workspace 秒级完成
cd my-demo
pnpm install --ignore-workspace
pnpm dev
```

> 💡 检测逻辑：cwd 向上找 `pnpm-workspace.yaml` + `packages/bundlekit-service` 双重判定。设 `DEVKIT_DEP_MODE=npm` 可强制走 npm 模式（用于测试）。

## 启动文档站

```bash
pnpm --filter bundlekit-cli-docs run dev
# 默认 http://localhost:8000
```

## 常用脚本速查

| 命令 | 作用 |
|---|---|
| `pnpm build:all` | 构建所有 @bundlekit/* 包 |
| `pnpm test` | 跑 unit 测试（约 0.5s） |
| `pnpm test:integration` | 跑集成测试矩阵（约 20s） |
| `pnpm test:e2e` | 跑 Playwright HMR 测试（需先 `pnpm playwright install chromium`） |
| `pnpm test:all` | 三档全跑 |
| `pnpm changeset` | 写 changeset 记录变更 |
| `pnpm changeset version` | 本地预览版本号变化 |
| `pnpm changeset publish` | 发版（仅 CI 自动调用） |

## IDE 配置

推荐 VSCode 安装：

- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)（如改 vue 相关包）
- vitest（运行测试）

仓库根目录已配置 `.editorconfig` 与 `.prettierrc.js`，遵循即可。

## 包间引用关系

```
@bundlekit/shared-utils
    ↓（被所有包依赖）
@bundlekit/bundler-{webpack,vite,rspack,rollup,rolldown}
    ↓（运行时由 service 动态加载）
@bundlekit/service
    ↓（被生成项目依赖）
@bundlekit/cli      ← 独立，不依赖 service / bundler

@bundlekit/plugin-{react,vue}   ← 独立，由用户项目自选
@bundlekit/plugin-mock          ← 独立 dev 工具
@bundlekit/request              ← 独立 runtime 库
```

构建时无需手动 build，turbo 会按依赖图自动排序。

## 故障排查

### `pnpm install` 卡住

确认 `.npmrc` 没指向不可达的 registry。仓库根目录可能有 `.npmrc` 配置：

```
registry=https://registry.npmjs.org/
```

国内开发可暂时切淘宝镜像：`pnpm config set registry https://registry.npmmirror.com`。

### `bc create` 创建项目卡在 install

预期行为：在 monorepo 内自动走 link 模式，install 秒级。如果卡住：

```bash
# 跳过 install，让你手工处理
DEVKIT_SKIP_INSTALL=1 pnpm exec bc create my-demo -t react-ts

# 或强制 npm 模式（包未发布时会失败，仅用于验证替换逻辑）
DEVKIT_DEP_MODE=npm pnpm exec bc create my-demo -t react-ts
```

### TypeScript 报 "Cannot find module"

某个包刚改完 `lib/` 但未 build，`dist/` 还是旧的。重新 build 该包：

```bash
pnpm --filter @bundlekit/<改的包> run <build script>
```
