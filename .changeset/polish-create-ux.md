---
"@devkit/cli": minor
"@devkit/plugin-react": minor
"@devkit/plugin-vue": minor
---

`@devkit/cli` 的 `create` 命令体验优化：

- **修复**：交互式描述输入框输入字符即跳步的 bug。`CreateApp` 状态机现在使用显式 `descriptionSubmitted` 标志，仅 `onSubmit`（按回车）时推进步骤。
- **新增**：包管理器选择步骤。在 bundler 选完后、tasks 启动前插入 PM step；默认顺序 `pnpm` > `yarn` > `npm`，未安装的项灰显 `(未安装)` 不可选；新增 `--pm <pnpm|yarn|npm>` 命令行选项与 `DEVKIT_PM` 环境变量旁路（CI 友好）。
- **新增**：`Done` 视图根据所选 PM 渲染对应启动指令（`pnpm dev` / `yarn dev` / `npm run dev`），并在信息面板显示包管理器信息。
- **新增**：bundler 列表分层呈现。主菜单只列 `vite` / `webpack` / `rspack` + `更多打包器 →`；选中后切到次级列表 `rollup` / `rolldown` + `← 返回`；`-b` 命令行选项行为不变（任意 5 个均可直接传）。
- **新增**：`Select` 组件原生支持 `disabled` 项（灰显且键盘导航跳过）与 `onBack` 回调（响应 Esc / Backspace）。
- **变更（@devkit/plugin-react、@devkit/plugin-vue）**：`template-react-ts` / `template-react-js` / `template-vue3-ts` / `template-vue3-js` 的 `package.json` 模板精简，仅生成 `clean` / `dev` / `build` 三个脚本；删除 `${bundler}:dev` / `${bundler}:prod` 等 bundler 专属别名（与 `dev` / `build` 完全等价的冗余项）。

迁移：已存在的项目模板不受影响，仅新建项目的 scripts 行为变化。CI 用户可以用 `--pm` 或 `DEVKIT_PM` 跳过 PM 选择步骤。
