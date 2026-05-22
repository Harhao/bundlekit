## Context

当前 `bundlekit-cli create` 命令支持两种依赖模式：
- **link 模式**：检测到 monorepo 环境时，用 `link:/abs/path` 协议将 `@bundlekit/*` 包链接到新项目
- **npm 模式**：从 npm registry 安装，版本号为 `^cliVersion`

link 模式的初衷是方便 monorepo 内开发调试，但实际造成了 pnpm workspace 冲突和 yarn 不兼容的问题。业界主流 CLI（create-react-app、create-vue、Vite）均采用纯 npm registry 模式。

## Goals / Non-Goals

**Goals:**
- 移除 link 模式，统一使用 npm registry 安装依赖
- 保持对 npm、yarn、pnpm 三个包管理器的兼容
- 保持现有 `--pm` 环境变量和 CLI flag 功能不变
- 简化代码，移除 monorepo 检测相关的死代码

**Non-Goals:**
- 不改变模板渲染逻辑
- 不改变 bundler/plugin 注入逻辑
- 不改变 ink UI 的交互流程（仅移除 depMode 显示行）

## Decisions

### 1. 移除 `IDepModeKind` 中的 `"link"` 类型

**选择**：将 `IDepModeKind` 从 `"link" | "npm"` 简化为 `"npm"`

**理由**：
- link 模式是造成本次 bug 的根源
- 业界标准做法是纯 registry 安装
- 简化后 `IDepMode` 接口只需 `kind` 和 `cliVersion`，`monorepoRoot` 字段可移除

**替代方案**：
- 改用 `file:` 协议兼容所有包管理器 — 可行但增加复杂度，且 pnpm 下 `file:` 是复制而非 symlink，开发体验差
- 保留 link 模式但修复 workspace 检测 — 治标不治本，增加维护负担

### 2. `DEVKIT_DEP_MODE` 环境变量静默降级

**选择**：`DEVKIT_DEP_MODE=link` 不再报错，静默降级为 npm 模式

**理由**：
- 避免 CI 脚本中已有的 `DEVKIT_DEP_MODE=link` 突然报错
- npm 模式是安全的默认行为

### 3. 移除 `isPnpmWorkspaceMember` 和 `findPnpmWorkspaceRoot`

**选择**：从 `pkgManager.ts` 中移除这两个函数

**理由**：
- 这两个函数仅用于 link 模式下的 `--ignore-workspace` 判断
- 移除 link 模式后不再需要

### 4. `Done` 视图简化

**选择**：移除 "依赖模式" 显示行

**理由**：
- 只有一种模式（npm registry），显示无意义
- 减少 UI 噪音

## Risks / Trade-offs

- **[风险] 已有 `DEVKIT_DEP_MODE=link` 的 CI 脚本** → 静默降级为 npm 模式，不影响功能，但安装时间可能略增（需从 registry 下载）
- **[风险] monorepo 内开发调试本地包的需求** → 开发者可手动 `npm link` 或使用 `file:` 协议，这是业界标准做法
- **[权衡] 移除 monorepo 自动检测** → 代码更简单，但丢失了 "在 monorepo 内自动用 link" 的便利性。这是有意为之：便利性不应以正确性为代价
