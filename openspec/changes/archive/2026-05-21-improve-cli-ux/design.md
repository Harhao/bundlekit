## Context

**当前 cli 入口**

```
index.ts
  └─ commander
       ├─ create <name> [-t -b -d]
       │     └─ enquirer.prompt × 2 (template, bundler)
       │     └─ new Creator().create(name, options)
       │           ├─ fs 模板渲染
       │           ├─ pm.add (install)
       │           ├─ invokeGenerator (plugin generator)
       │           └─ Logger / Spinner 反馈
       └─ add <plugin>
             └─ AddCommand.add → pm.add → invokeGenerator
```

**目标视觉**

```
╔════════════════════════════════════════════════════╗
║  ████ ██   ██ ██     ██ ██  ██  ██ ██████          ║
║  ██   ██   ██ ██     ██  ██ ██ ██   ██             ║
║  ████ ██   ██  ██   ██    ███████   ██             ║
║                                                    ║
║          BUNDLE-DEVKIT v0.1.0                      ║
╚════════════════════════════════════════════════════╝

┌─ Step 1/4 · 模板 ────────────────────────────────┐
│  ❯ React + TypeScript                           │
│    React + JavaScript                           │
│    Vue 3 + TypeScript                           │
│    Vue 3 + JavaScript                           │
└─────────────────────────────────────────────────┘

┌─ Step 2/4 · 打包器 ──────────────────────────────┐
│    Vite                                         │
│  ❯ Webpack                                      │
│    Rspack                                       │
│    Rollup                                       │
│    Rolldown                                     │
└─────────────────────────────────────────────────┘

┌─ Step 3/4 · 描述 ────────────────────────────────┐
│  ▎ A demo app                                   │
└─────────────────────────────────────────────────┘

⠋ 正在生成项目结构...
✔ 已写入 12 个文件
⠙ pnpm install...
✔ 依赖安装完成
✔ plugin generator 完成
🎉  项目 my-app 创建成功！

  cd my-app
  pnpm dev
```

**约束**

- 仅改 `@devkit/cli`，其他包零改动。
- 保留对 CI / 非 TTY 环境的支持。
- 与 change 1 的 confirm 工具协同（service 在 service 包中改动；cli 也在 ink 形态下重新提供同语义的 confirm UI）。

## Goals / Non-Goals

**Goals**

- ink 化所有 cli 交互（template/bundler 选择、project 名校验、安装进度、完成提示、错误展示）。
- 保留 generator 现有接口，generator 实现方（plugin-react / plugin-vue 等）零改动。
- TTY fallback 保证 CI 可用。
- 构建产物砍掉 cjs 入口，bin 仅 ESM。
- 与 enquirer/Logger/Spinner 的现有 API 解耦：cli 内部可以用 ink；shared-utils 的 Logger 仍为其他包服务。

**Non-Goals**

- 不引入路由 / 多 tab 等复杂 ink pattern。
- 不实现 cli 内的 file explorer 或图形菜单。
- 不动 `@devkit/shared-utils` 的 Logger / Spinner（其他包仍在用）。
- 不在 service 内引入 ink。

## Decisions

### D1：渲染入口形态

**采用单一 root component + 子页面 switch**

```tsx
// lib/ui/App.tsx
const App = ({ command, params }) => {
  switch (command) {
    case 'create': return <CreateApp params={params} />;
    case 'add':    return <AddApp params={params} />;
    case 'help':   return <HelpApp />;
    case 'version':return <VersionApp />;
  }
};

// index.ts
const program = new Command();
program.command('create <name>')
  .option('-t,--template <t>')
  .option('-b,--bundler <b>')
  .option('-d,--description <d>')
  .action((name, opts) => {
    if (!process.stdout.isTTY) {
      // fallback to enquirer-based legacy path
      return legacyCreate(name, opts);
    }
    render(<App command="create" params={{ name, opts }} />);
  });
```

### D2：ink 组件库选型

| 库 | 用途 | 选择理由 |
|---|---|---|
| `ink` | 渲染核心 | 必选 |
| `ink-select-input` | 选项菜单 | 老牌稳定 |
| `ink-text-input` | 单行文本输入 | 老牌稳定 |
| `ink-spinner` | 加载动画 | 老牌稳定 |
| `ink-gradient` | 彩色文字 | banner 用 |
| `ink-big-text` | ASCII art | banner 用 |
| `@inkjs/ui`（备选） | 现代化 UI 套件 | 二期评估，本期不引入 |

不引入 `ink-confirm`：直接用 `<Select options={[yes, no]}>` 自行实现，避免一个包只为了一个 UI。

### D3：受控状态管理

每个 ink App 用 `useState` + `useReducer` 管理步骤进度：

```ts
type Step = 'template' | 'bundler' | 'description' | 'generating' | 'installing' | 'generator' | 'done' | 'error';
```

副作用（fs / pm / generator）用 `useEffect` 触发，结果回写状态机。

### D4：副作用与组件解耦

把 `Creator` 的副作用方法（renderTemplates、installDeps、runGenerator）抽出来作为**纯函数**模块：`lib/commands/create/actions.ts`。ink 组件 import 这些 action 后在 useEffect 中调用，便于测试。

```ts
// lib/commands/create/actions.ts
export async function renderTemplates(opts): Promise<string[]>
export async function installDeps(targetDir): Promise<void>
export async function runGenerator(pluginPkg, targetDir, api): Promise<{ hasPendingDeps: boolean }>
```

`Creator` 类要么删除要么变成 thin wrapper，逐步淘汰。

### D5：TTY fallback 策略

```
入口 if (process.stdout.isTTY === false || process.env.DEVKIT_NO_INK === '1')
  → 走旧路径（enquirer + Logger）
否则
  → render(<App />)
```

`DEVKIT_NO_INK` 给用户 escape hatch。CI 自动检测 isTTY=false，无需配置。

### D6：bin 只发 ESM

```jsonc
{
  "type": "module",
  "main": "./dist/index.mjs",
  "bin": {
    "devkit-cli": "./dist/index.mjs",
    "dc":         "./dist/index.mjs"
  }
}
```

`require('@devkit/cli')` 的形态不再支持（cli 本就是 bin，没人 require）。砍掉 cjs 输出。

### D7：rollup 配置改造

- `@rollup/plugin-typescript` 加 `jsx: 'react-jsx'`、`jsxImportSource: 'react'`
- `external`：扩展现有 external 列表，加上 `react`、`react-dom`、`ink`、所有 `ink-*`
- 保留 `@rollup/plugin-commonjs` 处理 enquirer 等老 cjs 依赖

如发现 rollup 处理 jsx 困难，备选：换 tsup / unbuild。本期先尝试 rollup。

### D8：测试策略

`ink-testing-library` 提供 `render` 与 `lastFrame()`。在 `__tests__` 中：

```ts
it('selects template when arrow + enter', () => {
  const { stdin, lastFrame } = render(<CreateApp params={...} />);
  stdin.write('\u001b[B'); // arrow down
  stdin.write('\r');       // enter
  expect(lastFrame()).toContain('打包器');
});
```

副作用（fs / pm）在测试中 mock。

### D9：错误展示

错误状态用专门组件：

```tsx
<Box flexDirection="column">
  <Text color="red" bold>✘ {step} 失败</Text>
  <Text color="redBright">{error.message}</Text>
  <Text color="gray">{error.stack}</Text>
</Box>
```

并以非零 exit code 退出。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| ink 在 Windows 老终端兼容差 | docs 提示 "推荐 Windows Terminal / iTerm2"；fallback 路径完整保留 |
| ESM-only 的 cli 在 Node < 18 跑不动 | 已要求 node >= 18，与 service 一致 |
| rollup 处理 jsx 出问题 | 备选 tsup；先尝试 rollup |
| ink 与 commander 整合时输出错乱（commander 内置帮助打印冲突 ink rerender） | help / version 命令不进 ink 路径，直接走 commander 输出 |
| 用户在 ink 渲染中按 Ctrl+C，ink 不一定能优雅退出 | `useApp().exit()` + `process.on('SIGINT', cleanup)` 显式处理 |
| ink-testing-library 与现有 vitest 配置可能 jsx 解析冲突 | vitest config 加 `esbuild.jsx: 'automatic'` |

## Migration Plan

1. **Phase 1：基础设施**
   - tsconfig + rollup 配置 jsx、ink external
   - 安装 ink 系列依赖
   - 新增 `lib/ui/` 与 `<App>` 骨架

2. **Phase 2：抽出 actions**
   - `Creator` 类副作用方法变成 `actions.ts` 中的纯函数
   - 旧 enquirer 路径保留作为 fallback

3. **Phase 3：实现 ink 组件**
   - `<Banner>`、`<CreateApp>`（含 Step 1-4）、`<AddApp>`、`<TaskList>`、`<Done>`、`<ErrorView>`

4. **Phase 4：bin 收敛 ESM**
   - rollup 输出仅 mjs
   - package.json bin 改双指向

5. **Phase 5：CI 与文档**
   - CI 环境 smoke：`DEVKIT_NO_INK=1 dc create demo -t react-ts -b vite -d demo`
   - docs/guide/cli.md 加截图与 fallback 说明

回滚：每个 phase 独立 revert；最坏情况恢复 `index.ts` 的 enquirer 版本即可。

## Open Questions

- 是否要把 `dc add bundler-X` 也加 ink 化？建议第一版做。
- 是否引入彩色主题切换？建议不做。
- 是否允许用户配置 banner（自定义 logo）？建议不做（公司内部分发可后续支持）。
- ink-testing-library 的版本与 vitest 兼容性需要 spike。
