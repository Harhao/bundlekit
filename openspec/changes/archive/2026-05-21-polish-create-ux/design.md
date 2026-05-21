## Context

`@devkit/cli` 在最近两个 change（`improve-cli-ux`、`refactor-bundler-deps`）中已经完成了：
- ink ESM-only 渲染 + commander 路由
- TTY 检测与 `DEVKIT_NO_INK` fallback
- `actions.ts` 纯函数化，`CreateApp` 用 useEffect 编排 task
- bundler 解耦（cli 不再依赖 bundler-* 包，按 `-b` 选项写入项目 devDeps）
- `confirm` + `DEVKIT_AUTO_INSTALL` 处理 missing-bundler

但用户实际跑 `dc create my-app -t react-ts` 时仍能立刻发现 4 处粗糙体验，本 change 把它们一次性收掉。

涉及的代码区域非常局部：
- `packages/devkit-cli/index.tsx`（CLI 入口、commander 选项）
- `packages/devkit-cli/lib/ui/CreateApp.tsx`（状态机 + step 渲染）
- `packages/devkit-cli/lib/ui/Select.tsx`（选择列表组件）
- `packages/devkit-cli/lib/ui/Done.tsx`（完成视图）
- `packages/devkit-cli/lib/commands/create/actions.ts`（`installDeps` 签名）
- `packages/devkit-cli/lib/commands/create/creator.ts`（legacy 路径同步）
- `packages/devkit-plugin-react/templates/template-react-{ts,js}/package.json.ejs`
- `packages/devkit-plugin-vue/templates/template-vue3-{ts,js}/package.json.ejs`

不触及 service / bundler-* / docs / changeset 之外的内容。

## Goals / Non-Goals

**Goals:**
- 修复描述输入框跳步 bug，回归预期：用户必须按回车才前进
- 模板生成的 `package.json` 仅保留 `dev` / `build` / `clean`
- bundler 选择列表分层：3 个推荐 + 1 个"更多打包器 →"折叠 2 个实验性
- 新增 PM 选择步骤（ink prompt + enquirer fallback + `--pm` flag + `DEVKIT_PM` env），所选 PM 透传到 `installDeps` 与 `Done` 视图启动指引
- 全部修改通过现有 `__tests__/` 单测（无回归）

**Non-Goals:**
- 不引入新的 npm 依赖
- 不改 `add` 命令逻辑
- 不改非 cli 包（service / bundler / shared-utils 不动）
- 不动文档站（docs 沉淀放到 `docs-installation-flow` change 收尾）
- 不实现键盘交互快照测试（ink-testing-library 留给后续）
- 不支持 `bun` 等其他 PM（仅 pnpm/yarn/npm 三选）

## Decisions

### D1: description 状态机修复 — 显式 `descriptionSubmitted` flag

**问题**：当前 `CreateApp.tsx:71`：
```tsx
} else if (params.description === undefined && description === "") {
    currentStep = "description";
}
```
用户每按一键 `description` 就被 `setDescription("a")`，立刻不再为空，`currentStep` 跳到 `tasks`。

**采用方案**：
```tsx
const [descriptionSubmitted, setDescriptionSubmitted] = useState(
  params.description !== undefined,
);
// onSubmit 时 setDescriptionSubmitted(true)
// step 判断改为 !descriptionSubmitted ? "description" : "tasks"
```

**为什么不直接看 `description !== ""`**：用户允许提交空描述（onSubmit("") 被 fallback 成 " "），但 onChange 期间空也是合法值，无法区分"输到一半"。

**为什么不用 ref**：state 触发 re-render 才能让 step 切换显示出 tasks，ref 不行。

### D2: 模板 scripts 精简 — 全部删除 bundler 专属脚本

```diff
  "scripts": {
    "clean": "rimraf dist",
    "dev":   "devkit-service serve --bundler <%= bundler %> --mode development",
-   "build": "devkit-service build --bundler <%= bundler %> --mode production",
-   "vite:dev":   "...",
-   "vite:prod":  "..."
+   "build": "devkit-service build --bundler <%= bundler %> --mode production"
  }
```

**为什么不保留 `${bundler}:dev` 作为别名**：
- `dev` 已经用 `<%= bundler %>` 模板字面量绑定到 create 时所选 bundler，二者完全等价
- 多保留一份只增加用户混淆"两个有什么区别"
- 真要切 bundler 应该走 `dc add bundler-rollup` + 改 scripts，不应该靠预生成多版本脚本

**适用模板**：4 个 `package.json.ejs`（react-ts/js + vue3-ts/js）

### D3: bundler 列表分层 — 主菜单 + 次菜单

**采用方案**：在 `CreateApp.tsx` 内维护 `bundlerLevel: 'primary' | 'secondary'` 局部状态。

```
主菜单 BUNDLERS_PRIMARY:        次菜单 BUNDLERS_SECONDARY:
  Vite      —— 开发体感最佳      Rollup    —— 适合库构建
  Webpack   —— 生态最完整        Rolldown  —— 实验性
  Rspack    —— Rust 极速         ← 返回
  更多打包器 →                   
```

`Select` 组件 `onSelect(value)`：
- 若 `value === '__more__'` 则 `setBundlerLevel('secondary')`
- 若 `value === '__back__'` 则 `setBundlerLevel('primary')`
- 否则 `setBundler(value)` 进入下一步

**为什么不用 group header**：ink-select-input 不原生支持分组；自己实现 group header 改造面更大。两层独立列表足够清晰。

**为什么不直接平铺加分隔线**：用户反馈 rollup/rolldown 的"实验性"权重应明显低于其他三个；折叠是更强的视觉信号。

**`-b` 命令行选项行为不变**：传 `-b rollup` / `-b rolldown` 直接跳过 bundler step，不受分层影响。

### D4: PM 选择策略

**位置**：bundler step 之后、description step 之前。
原因：description 是可选的（按回车跳过），放在最后；PM 是后续 install 必需的，必须在 tasks 启动前定下来。

```
template → bundler → pm → description → tasks → done
```

**默认顺序**：`pnpm` > `yarn` > `npm`
（与现代前端社区共识一致；`pnpm` 在本仓库已是固定 PM）

**可用性检测**：启动时同步 spawn 三个 `which`，检测不到则该项 `disabled` 在 ink 列表中灰显。
- `Select` 组件需扩展支持 `disabled?: boolean` 字段
- 全部不可用时（极端情况）回退到 npm 并打 warning

**透传链路**：

```
CreateApp 选 pm → setPm(value)
   │
   ▼
installDeps(targetDir, { pm })   ← 签名扩展
   │
   ▼
new PackageManager({ context, forcePackageManager: pm })
                                   ↑
                            （现有字段，原生支持）
```

**`Done` 视图的启动指令**：

```ts
const runCmd = pm === 'npm' ? 'npm run' : pm;
// 渲染：cd my-app && {pm} install   →  跳过（已装）
//      {runCmd} dev
```

**命令行旁路**：
- `--pm <pnpm|yarn|npm>` 跳过 prompt
- `DEVKIT_PM=pnpm` 环境变量同效
- 优先级：`--pm` > `DEVKIT_PM` > 用户交互

**legacyCreate（非 TTY）**：用 enquirer 同步问，列表与可用性检测一致。

### D5: Select 组件如何支持 disabled

ink-select-input 0.6 不原生支持 disabled。两条路：

| 方案 | 内容 | 选用 |
|---|---|---|
| 自定义 itemComponent | 按 disabled 灰显，键盘导航过滤 | ✅ |
| Fork ink-select-input | 维护成本高 | ❌ |

itemComponent 定义在 `Select.tsx` 内部，用 `useInput` 监听 ↑↓，跳过 disabled 项。最小改动。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 删除 `${bundler}:dev/prod` 是 BREAKING：已存在的项目升级模板时跑 `vite:dev` 会失败 | 模板修改只影响新建项目；已存在项目用户自己的 `package.json` 不会被改写。changeset 标记为 patch（仅模板新建行为变化）|
| PM 选择步骤多一步增加交互成本 | `-b` 已选时只多 PM 一步；CI 用 `--pm` / `DEVKIT_PM` 完全跳过；常用路径仍可一次回车通过 |
| `which` 同步检测增加 ~30ms 启动开销 | 仅 create 路径执行；已经远小于 install 阶段成本，可接受 |
| disabled 项视觉灰显在不同终端配色下识别度不同 | 使用 ink dimColor + 末尾追加 `(未安装)` 文案双保险 |
| description 修复后用户首次按回车提交空字符串触发 fallback `" "` 仍显得 hacky | 考虑后续把 description 字段彻底改成可选（package.json 不写就不写），但本 change 保持现状最小化改动 |
| bundler 分层菜单的"返回"用 ←/Esc 还是显式 `← 返回` 行：键盘党 vs 鼠标党体感不同 | 同时支持：列表里有 `← 返回` 项 + `useInput` 监听 Esc/Backspace 键 |

## Migration Plan

1. 实施顺序（task 内顺序）：
   - 先做 #7（description bug fix）+ #6（template scripts）— 影响面最小，立刻可验
   - 再做 #3（bundler 分层）— 改 Select 与 CreateApp
   - 最后做 #2（PM 选择）— 涉及最多文件
2. 每步完成跑 `__tests__/` 单测；ink 视觉变化用真 TTY `tsx ./index.tsx create demo -t react-ts` 手动跑一遍
3. 全部完成后写 changeset：标记为 minor（新增 `--pm` / `DEVKIT_PM` / 分层 UI），含模板 BREAKING 提示
4. 回滚：每步独立可 revert；template 改动是文本删除，无运行时副作用
