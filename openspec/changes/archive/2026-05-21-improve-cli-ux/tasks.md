## 1. 工程基建

- [x] 1.1 `packages/devkit-cli/package.json` 新增依赖：`ink`、`ink-select-input`、`ink-text-input`、`ink-spinner`、`ink-gradient`、`ink-big-text`、`react`、`react-dom`、`@types/react`
- [x] 1.2 `packages/devkit-cli/tsconfig.json` 加 `"jsx": "react-jsx"`、`"jsxImportSource": "react"`
- [x] 1.3 `packages/devkit-cli/scripts/rollup.config.js` 改造：
- [x] 1.4 `packages/devkit-cli/package.json` 的 bin 改为：`devkit-cli` / `dc` 都指向 `dist/index.mjs`，移除 `main.cjs` 字段
- [x] 1.5 验证 `pnpm --filter @devkit/cli build` 能产出可执行的 `dist/index.mjs`

## 2. 副作用抽象

- [x] 2.1 新增 `packages/devkit-cli/lib/commands/create/actions.ts`，把 `Creator.create()` 的步骤拆为：
- [x] 2.2 actions 模块函数式纯化：不依赖类成员，纯参数 + 返回值
- [x] 2.3 `Creator` 类保留为 thin wrapper（用于非 TTY fallback path 与单测）

## 3. ink 组件

- [x] 3.1 新增 `packages/devkit-cli/lib/ui/Banner.tsx`：`ink-big-text` + `ink-gradient` 渲染 logo
- [x] 3.2 新增 `packages/devkit-cli/lib/ui/StepFrame.tsx`：步骤式表单的统一外框（标题 / 进度 / 子内容）
- [x] 3.3 新增 `packages/devkit-cli/lib/ui/Select.tsx`：包装 `ink-select-input`，统一样式与按键
- [x] 3.4 新增 `packages/devkit-cli/lib/ui/TextInput.tsx`：包装 `ink-text-input`
- [x] 3.5 新增 `packages/devkit-cli/lib/ui/TaskList.tsx`：用 `ink-spinner` + check mark 展示多任务进度
- [x] 3.6 新增 `packages/devkit-cli/lib/ui/Done.tsx`：成功提示 + 下一步指令
- [x] 3.7 新增 `packages/devkit-cli/lib/ui/ErrorView.tsx`：错误展示组件
- [x] 3.8 新增 `packages/devkit-cli/lib/ui/CreateApp.tsx`：状态机（template → bundler → description → tasks → done）驱动整个 create 流程
- [x] 3.9 新增 `packages/devkit-cli/lib/ui/AddApp.tsx`：add 命令 ink 形态
- [x] 3.10 新增 `packages/devkit-cli/lib/ui/App.tsx`：根组件，按 command 路由到 CreateApp / AddApp

## 4. 入口集成

- [x] 4.1 改写 `packages/devkit-cli/index.ts`：commander 解析后判断 `process.stdout.isTTY && !process.env.DEVKIT_NO_INK`
- [x] 4.2 TTY 路径：`render(<App command params />)`
- [x] 4.3 非 TTY 路径：调用 `legacyCreate(name, opts)` / `legacyAdd(plugin)`，沿用 enquirer 与 Logger
- [x] 4.4 SIGINT 处理：`useApp().exit()` + `process.on('SIGINT', cleanup)`，避免遗留半渲染状态
- [x] 4.5 `help` / `version` 命令仍走 commander 默认输出，不走 ink

## 5. Generator 兼容

- [x] 5.1 `lib/utils/generatorRunner.ts` 中的 `buildGeneratorAPI` 行为不变，但底层 `prompt` 在 TTY 路径下用 ink 实现，其他场景退回 enquirer
- [x] 5.2 实现一个 `inkPromptAdapter(question)` 把 enquirer 风格 questions 转换为 ink `<SelectInput>` / `<TextInput>` 渲染并返回 Promise<answers>
- [x] 5.3 验证现有 `@devkit/plugin-react/generator` 与 `@devkit/plugin-vue/generator` 的 prompt 在 ink 路径下能正常工作

## 6. 协同 Change 1（confirm 工具）

- [x] 6.1 ink 路径下的 confirm 用 ink Select（yes / no）实现；非 TTY 走 shared-utils 的 enquirer-based confirm
- [x] 6.2 在 cli 内部定义统一的 `confirm({ message, defaultValue })` facade，按场景路由到 ink 或 enquirer

## 7. 测试

- [ ] 7.1 安装 `ink-testing-library`
- [ ] 7.2 vitest 配置 jsx 解析（`esbuild.jsx: 'automatic'`）
- [ ] 7.3 `__tests__/cli-ink/CreateApp.test.tsx`：模拟键盘选择、验证最终调用 actions.installDeps 等
- [ ] 7.4 `__tests__/cli-ink/AddApp.test.tsx`：覆盖 plugin 与 bundler 短名解析
- [x] 7.5 `__tests__/cli-fallback/legacy.test.ts`：DEVKIT_NO_INK=1 时不加载 ink
- [x] 7.6 smoke：`DEVKIT_NO_INK=1 dc create demo -t react-ts -b vite` 在 CI 中通过

## 8. 文档（最小补丁）

- [x] 8.1 `docs/guide/cli.md` 加入截图（asciinema 转 svg 或文字示意）
- [x] 8.2 标注 fallback 机制：`DEVKIT_NO_INK=1` 与 CI 行为
- [x] 8.3 注明 Windows 推荐 Windows Terminal / Cmder
- [x] 8.4 完整安装心智重写交给 Change 5

## 9. 收尾

- [x] 9.1 examples/ 目录下手动跑一遍 `dc create demo` 视觉验证
- [x] 9.2 changeset：标注 `BREAKING（cjs 入口移除）` 与"Windows 终端兼容性提示"
