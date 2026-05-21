## 1. 类型定义清理

- [x] 1.1 在 `packages/devkit-shared-utils/lib/types/cli-init/index.ts` 中将 `IDepModeKind` 从 `"link" | "npm"` 简化为 `"npm"`
- [x] 1.2 移除 `IDepMode` 接口中的 `monorepoRoot` 字段
- [x] 1.3 移除 `DEP_MODE_ENV_KEYS` 中的 `MONOREPO_ROOT` 键（保留 `MODE`）

## 2. depMode 核心逻辑简化

- [x] 2.1 在 `packages/devkit-cli/lib/utils/depMode.ts` 中移除 `findMonorepoRoot()` 函数
- [x] 2.2 简化 `resolveDepMode()` — 移除 monorepo 自动检测和 `link` 模式分支，始终返回 `{ kind: "npm", cliVersion }`
- [x] 2.3 简化 `resolveDevkitDepValue()` — 移除 `link:` 协议分支，统一返回 `^cliVersion`
- [x] 2.4 更新 `resolveDevkitDepValue()` 的注释（移除 link 模式说明）

## 3. PackageManager 清理

- [x] 3.1 在 `packages/devkit-shared-utils/lib/shared/pkgManager.ts` 中移除 `findPnpmWorkspaceRoot()` 函数
- [x] 3.2 移除 `isPnpmWorkspaceMember()` 函数
- [x] 3.3 在 `runCommand()` 中移除 pnpm workspace 判断逻辑（`--ignore-workspace` 相关代码）

## 4. UI 简化

- [x] 4.1 在 `packages/devkit-cli/lib/ui/Done.tsx` 中移除 `DepModeKind` 类型定义
- [x] 4.2 移除 `Done` 组件的 `depMode` prop 及 "依赖模式" 显示行
- [x] 4.3 在 `packages/devkit-cli/lib/ui/CreateApp.tsx` 中简化 depMode 日志（移除 `link 模式 →` 分支）
- [x] 4.4 更新 `CreateApp` 传递给 `Done` 的 props（移除 `depMode`）

## 5. Creator 日志简化

- [x] 5.1 在 `packages/devkit-cli/lib/commands/create/creator.ts` 中简化 depMode 日志（移除 `link 模式` 分支）

## 6. 测试更新

- [x] 6.1 更新 `__tests__/depMode.test.ts` — 移除 `findMonorepoRoot` 测试、`resolveDevkitDepValue` 的 link 模式断言、`normalizeDeps` 的 link 模式断言
- [x] 6.2 更新 `__tests__/depMode.test.ts` — `resolveDepMode` 测试改为始终返回 npm 模式
- [x] 6.3 更新 `__tests__/integration/cli/cli-create.test.ts` — link 模式断言改为 npm 模式（`^cliVersion`）
- [x] 6.4 运行 `pnpm test` 确认所有测试通过
