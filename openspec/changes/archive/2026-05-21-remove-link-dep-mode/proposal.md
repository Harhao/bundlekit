## Why

CLI `create` 命令的 `link` 依赖模式（在 monorepo 内生成项目并用 `link:` 协议链接本地包）导致两个严重问题：

1. **pnpm 安装卡住**：新项目在 `packages/` 下被 pnpm 误判为 workspace member，`link:` 协议在 workspace 上下文中冲突，导致 `pnpm install` 永久阻塞
2. **yarn 安装静默失败**：yarn 1.x 不支持 `link:` 协议，安装命令报错但被 `executeCommand` 吞掉，依赖未安装到 node_modules 却无任何提示

业界主流 CLI（create-react-app、create-vue、Vite）的做法是：**生成的项目始终从 npm registry 安装依赖**，不链接本地包。monorepo 开发者如需调试本地包，手动 `npm link` 即可。

## What Changes

- **BREAKING** 移除 `IDepModeKind` 中的 `"link"` 类型，仅保留 `"npm"`
- **BREAKING** 移除 `DEVKIT_DEP_MODE=link` 和 `DEVKIT_MONOREPO_ROOT` 环境变量支持
- 移除 `findMonorepoRoot()` 函数及其在 `resolveDepMode` 中的自动检测逻辑
- 移除 `resolveDevkitDepValue()` 中的 `link:` 协议分支，统一返回 `^cliVersion`
- 移除 `isPnpmWorkspaceMember()` 函数（仅用于 link 模式的 workspace 判断）
- 简化 `Done` 视图，移除 "依赖模式" 显示行
- 简化 `CreateApp` / `Creator` 中 depMode 相关的日志输出
- 更新 `__tests__/depMode.test.ts` 和 `cli-create.test.ts` 中的断言

## Capabilities

### Modified Capabilities

- `cli-create`: 依赖解析统一为 npm registry 模式，移除 link 模式相关行为

## Impact

- **代码文件**：
  - `packages/bundlekit-shared-utils/lib/types/cli-init/index.ts` — 移除 `IDepModeKind` 中的 `"link"`，简化 `IDepMode` 接口
  - `packages/bundlekit-cli/lib/utils/depMode.ts` — 移除 `findMonorepoRoot`、简化 `resolveDepMode` 和 `resolveDevkitDepValue`
  - `packages/bundlekit-shared-utils/lib/shared/pkgManager.ts` — 移除 `isPnpmWorkspaceMember` 和 `findPnpmWorkspaceRoot`
  - `packages/bundlekit-cli/lib/ui/Done.tsx` — 移除 depMode 显示
  - `packages/bundlekit-cli/lib/ui/CreateApp.tsx` — 简化 depMode 日志
  - `packages/bundlekit-cli/lib/commands/create/creator.ts` — 简化 depMode 日志
- **测试文件**：
  - `__tests__/depMode.test.ts` — 更新断言，移除 link 模式测试
  - `__tests__/integration/cli/cli-create.test.ts` — 更新断言
- **环境变量**：`DEVKIT_DEP_MODE` 和 `DEVKIT_MONOREPO_ROOT` 将被忽略（不再报错，静默降级为 npm 模式）
