## Why

`pnpm debug`（即 `dc create test-app -t react-ts`）在本地执行时会出现"卡住不动"的体感，根因不是 install 真的卡了，而是 cli 流程中混杂了多个被 spinner / log 噪音遮蔽的隐藏问题：

1. **`@bundlekit/plugin-react` 的 generator 在 install 之后弹了一个 enquirer prompt**（"是否同时安装 @bundlekit/request HTTP 客户端？"），但前一步是 `Spinner` 转动 + `setBinaryMirrors` 的 `ERR_INVALID_PROTOCOL` stderr 噪音，把 prompt 文案淹没，用户看不到提示就以为 cli hang 了
2. **prompt 在 ink TTY 路径下也会弹**，导致 ink 渲染 frame 与 enquirer 的 raw 模式 stdin 抢占冲突
3. **plugin-react generator 写的依赖版本 `^1.0.0` 是死硬编码**，违反 lockstep 约定，且 `@bundlekit/request` 当前版本是 `0.0.1`，写 `^1.0.0` 装不到任何东西
4. **`PackageManager.install` 在 monorepo 子目录运行时不传 `--ignore-workspace`**，依赖 `link:` 协议侥幸绕开 workspace 解析，但属于脆弱实现，外部用户在自己的 monorepo 内创建 bundlekit 项目会立刻撞坑
5. **`PackageManager.setBinaryMirrors` 探测 `binary-mirror-config` 的失败被打到 stderr**，制造无意义噪音

这些问题串在一起让 cli 创建流程的 UX 看起来不可靠。本 change 一次性收掉。

## What Changes

- **`@bundlekit/plugin-react` generator**：
  - 在非 TTY、`DEVKIT_NO_PROMPT=1`、`CI=true` 任一条件下默认跳过 prompt（不安装 @bundlekit/request）
  - prompt 渲染前显式 `console.log("\n")` 加一个换行，避免被 spinner 残留遮蔽
  - 把硬编码 `^1.0.0` 改成 `workspace:^`（让 cli 的 `normalizeDeps` 兜底）
- **`@bundlekit/plugin-vue` generator**：相同改造（保持一致性）
- **`@bundlekit/cli` ink 路径**：在 `runGenerator` 之前注入 `process.env.DEVKIT_NO_PROMPT = "1"`，避免 generator 在 ink 渲染中抢 stdin
- **`@bundlekit/shared-utils` PackageManager**：
  - `install()` 自动检测 cwd 是否在 monorepo 内但非 workspace member，是则给 pnpm 命令追加 `--ignore-workspace`
  - `setBinaryMirrors` 抑制 `getMetadata` 调用失败的 stderr 输出（用 logger.debug 静默写入）
  - 探测 `binary-mirror-config` 时增加超时（避免国内镜像挂时拖整个流程）
- **`@bundlekit/cli`**：generator 调用前后加显式视觉分隔符，让 prompt 文案更醒目
- **集成测试**：新增 `cli-create-prompts.test.ts`，用 `DEVKIT_NO_PROMPT=1` 跑一遍完整 create 流程，断言 generator 跳过 prompt 且生成的 `package.json` 不含 `^1.0.0` 死硬编码版本
- **changeset**：标记所有受影响包为 patch（bug fix）

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `cli-create`：完整创建流程加入"在 ink / CI 路径下静默 generator prompt"的要求
- `bundler-installation`：`PackageManager.install` 在 monorepo 子目录场景的行为补充
- `plugin-react`：generator 的 prompt 触发条件 + 依赖版本注入约束
- `plugin-vue`：同 plugin-react

## Impact

- **代码**：
  - `packages/bundlekit-plugin-react/generator/index.ts`：prompt 条件 + 版本注入
  - `packages/bundlekit-plugin-vue/generator/index.ts`：同款（如存在）
  - `packages/bundlekit-cli/lib/ui/CreateApp.tsx`：runGenerator 前注入 DEVKIT_NO_PROMPT
  - `packages/bundlekit-cli/lib/commands/create/creator.ts`：legacy 路径同款
  - `packages/bundlekit-shared-utils/lib/shared/pkgManager.ts`：`--ignore-workspace` 检测 + 静默 binary-mirror error
- **测试**：
  - `__tests__/integration/cli/cli-create-prompts.test.ts`（新增）
  - 现有 `cli-create.test.ts` 加断言 "no `^1.0.0` literal 残留"
- **环境变量**：
  - `DEVKIT_NO_PROMPT=1` 行为扩展到 framework plugin generator（之前仅作用于 service 端 bundler 缺失提示）
- **依赖**：无新 npm 包
- **不影响**：service runtime / bundler adapters / SSR / CI workflow / docs 站
