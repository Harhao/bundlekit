## Why

`@devkit/cli` 在 `improve-cli-ux` 改造之后已切到 ink 渲染，但实际跑流程时仍有 4 处明显的体验粗糙点：

1. 描述输入框（ink TextInput）一旦敲入字符就立刻跳到下一步，没有等回车，原因是 `CreateApp` 状态机用"value 是否为空"误代"用户是否提交"
2. 项目模板的 `package.json` 同时生成 `dev`/`build` 与 `${bundler}:dev`/`${bundler}:prod`，后者完全是冗余的（bundler 已在 create 时锁定）
3. 5 个 bundler 在选择列表里平铺呈现，rollup/rolldown 实验性更强但视觉权重等同于 vite/webpack/rspack，新手容易误选
4. 包管理器完全靠 `PackageManager` 自动推断（基于 lockfile / `which`），新项目没 lockfile 时往往挑出与用户预期不符的工具，且 `Done` 视图给的"下一步"提示也不区分 `pnpm dev` / `yarn dev` / `npm run dev`

这些问题都局限在 cli + plugin 模板，不触及 service / bundler 运行时，适合作为一个聚焦的小改动一次收掉。

## What Changes

- 修复 `CreateApp.tsx` 描述输入框跳步 bug：引入显式 `descriptionSubmitted` 状态，状态机以 `onSubmit` 而非 value 非空作为前进条件
- 删除 `template-react-ts` / `template-react-js` / `template-vue3-ts` / `template-vue3-js` 的 `package.json.ejs` 中按 bundler 分支生成的 `${bundler}:dev` / `${bundler}:prod` 脚本，仅保留 `dev` / `build` / `clean`
- 在 ink `BUNDLERS` 选择列表中分两层呈现：主菜单 `vite` / `webpack` / `rspack` + 一行 `更多打包器 →`；选中后切到次级列表 `rollup` / `rolldown`。`-b` 命令行选项行为不变（任意 5 个都可直接传）
- 新增包管理器选择步骤：bundler 选完之后、tasks 启动之前插入 PM step，默认顺序 `pnpm` > `yarn` > `npm`，未安装的项灰显并禁选
  - 新增命令行选项 `--pm <pnpm|yarn|npm>` 用于跳过 prompt
  - 新增环境变量 `DEVKIT_PM` 旁路（CI 友好）
  - 选择结果通过 `forcePackageManager` 透传到 `installDeps`
  - `Done` 视图根据所选 PM 渲染对应的启动指令（`pnpm dev` / `yarn dev` / `npm run dev`）
  - `legacyCreate`（非 TTY）同步加 enquirer prompt

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `cli-create`: 修改"完整创建流程"要求，新增 PM 选择子步骤；修改"模板选择"相关交互链路，加入 bundler 分层菜单；新增"描述输入需显式提交"要求

## Impact

- **代码**：
  - `packages/devkit-cli/index.tsx`：`create` 命令新增 `--pm` 选项
  - `packages/devkit-cli/lib/ui/CreateApp.tsx`：状态机加 `descriptionSubmitted` 与 `pm` step
  - `packages/devkit-cli/lib/ui/Select.tsx`：（可能）支持 disabled 项与"展开次菜单"的回调
  - `packages/devkit-cli/lib/ui/Done.tsx`：根据 pm 渲染启动命令
  - `packages/devkit-cli/lib/commands/create/actions.ts`：`installDeps` 增加 `pm` 参数透传
  - `packages/devkit-plugin-react/templates/template-react-ts/package.json.ejs`、`template-react-js`、同 vue3 两个模板：删除 bundler 专属 scripts
- **API**：`installDeps(targetDir, opts?: { pm?: 'pnpm'|'yarn'|'npm' })` 签名扩展（向后兼容）
- **依赖**：无新 npm 包；继续使用 `enquirer` 与 `ink-select-input`
- **环境变量**：新增 `DEVKIT_PM`
- **CLI 选项**：新增 `--pm <pnpm|yarn|npm>`
- **不影响**：service runtime、bundler adapters、SSR 路径、文档站
