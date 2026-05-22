## Why

`@bundlekit/cli` 当前的交互层基于 `enquirer` + `console.log`（通过 Logger）+ 一个简单的 Spinner。体感上：交互单调，缺少视觉层次；进度反馈靠分散的 spinner / log 拼接，跨步骤的状态不连贯；新用户缺少 brand 识别的 banner。

业界脚手架（create-vite、create-rsbuild、create-modern）已经普遍采用 [ink](https://github.com/vadimdemedes/ink) — 用 React 组件树渲染 TUI — 来获得稳定的多区域更新、动画 spinner、彩色 logo、可复用的多步表单。

本 change 仅改造 `@bundlekit/cli` 的交互层（命令解析后的所有提示 / 进度 / 完成提示），其他模块（service / bundler-* / plugin-* / shared-utils）一律不动。

## What Changes

- 引入 ink 体系：`ink`、`ink-select-input`、`ink-text-input`、`ink-spinner`、`ink-gradient`、`ink-big-text`，以及 `react`、`react-dom` 作为 ink 的对等依赖。
- `packages/bundlekit-cli/index.ts` 重写为：commander 解析参数 → 根据命令 render 不同的 ink App（`<CreateApp options>`、`<AddApp plugin>` 等）。
- `Creator` 的交互部分（`prompt` 模板、`prompt` bundler）改为通过 ink App 输入；非交互部分（`fs` 渲染、`pm.add`）从 `Creator` 中保持纯函数化，方便被 ink 组件以受控方式调用。
- TTY 检测：`process.stdout.isTTY === false` 时回退到旧 enquirer 路径（保留作为 fallback），CI 环境继续可用。
- 构建产物：`@bundlekit/cli/dist/index.cjs` 砍掉，bin 仅保留 ESM 入口（`dist/index.mjs`）。`bin.bundlekit-cli` 与 `bin.dc` 都指向 `index.mjs`。
- rollup 构建配置改造：支持 jsx/tsx，`react / ink / ink-*` 全部 external，避免打入 bundle。
- tsconfig 加 `"jsx": "react-jsx"`、`"jsxImportSource": "react"`。
- 新增组件目录 `packages/bundlekit-cli/lib/ui/`：`<App>`、`<Banner>`、`<StepCreate>`、`<StepAdd>`、`<TaskList>`、`<Done>` 等可复用组件。

## Capabilities

### New Capabilities
- `cli-ink-ui`: 描述 cli 交互层的视觉与行为契约（banner、步骤式表单、spinner、TTY fallback、错误显示）。

### Modified Capabilities
- `cli-create`: 增加"通过 ink 步骤式表单完成 template / bundler 选择"
- `cli-mock` 等已存在 capability（如有 add 命令交互）也以 ink 展示

## Impact

**新增依赖（仅 cli 包）**
- `ink ^5`、`ink-select-input ^6`、`ink-text-input ^6`、`ink-spinner ^5`、`ink-gradient ^3`、`ink-big-text ^2`
- `react ^18`、`react-dom ^18`（ink 的 peer）
- 可选：`@types/react`、`@inkjs/ui`（更现代的 ink 组件库，待评估）

**构建配置**
- `packages/bundlekit-cli/tsconfig.json`：`jsx: react-jsx`
- `packages/bundlekit-cli/scripts/rollup.config.js`：jsx 处理（`@rollup/plugin-typescript` 已支持，仅需 `jsx: 'react-jsx'`）；`react / ink / ink-*` external
- `packages/bundlekit-cli/package.json`：bin 改单 ESM；type:module 已是

**API 变更**
- 终端用户视角：行为等价（同样的 prompt、同样的最终结果），仅视觉升级
- generator 接口保持不变（`IGeneratorAPI.prompt` 签名不变；仅 cli 内部实现可选用 ink 而非 enquirer）

**风险**
- ink ESM-only：cjs 入口砍掉对极少数 npm 老用户可能影响
- jsx 引入扩大 cli 构建复杂度，rollup 配置需仔细
- 非 TTY 环境（CI / pipe）需要保留 enquirer fallback 否则 CI 阻塞
- ink 渲染在某些终端（特别是 Windows cmd / 旧 Terminal）可能有兼容问题，需要 docs 说明
