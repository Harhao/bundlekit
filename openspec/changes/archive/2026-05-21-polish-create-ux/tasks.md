## 1. description 输入框跳步修复（#7）

- [x] 1.1 在 `CreateApp.tsx` 加入 `descriptionSubmitted: boolean` state，初始值 `params.description !== undefined`
- [x] 1.2 修改 `currentStep` 推断：将 `params.description === undefined && description === ""` 改为 `!descriptionSubmitted`
- [x] 1.3 `<TextInput onSubmit>` 处理：`setDescription(v || " "); setDescriptionSubmitted(true);`
- [x] 1.4 真 TTY 跑 `tsx ./index.tsx create demo -t react-ts -b vite` 验证：连续输入 5 个字符不跳步，回车后才跳

## 2. 模板 scripts 精简（#6）

- [x] 2.1 修改 `packages/devkit-plugin-react/templates/template-react-ts/package.json.ejs` 仅保留 `clean` / `dev` / `build`
- [x] 2.2 同步修改 `template-react-js/package.json.ejs`
- [x] 2.3 同步修改 `packages/devkit-plugin-vue/templates/template-vue3-ts/package.json.ejs`
- [x] 2.4 同步修改 `template-vue3-js/package.json.ejs`
- [x] 2.5 跑一遍 `dc create demo-react -t react-ts -b webpack`，断言 `demo-react/package.json` 的 `scripts` 仅有 3 个 key 且不含 `webpack:dev`

## 3. bundler 列表分层（#3）

- [x] 3.1 `Select.tsx` 扩展 `ISelectItem` 加 `disabled?: boolean`，`itemComponent` 按 `disabled` 灰显
- [x] 3.2 `Select.tsx` 的 `useInput` 跳过 `disabled` 项；按 ↑/↓ 时找下一个非 disabled 项
- [x] 3.3 `Select.tsx` 在 props 中暴露 `onBack?: () => void`，监听 Esc/Backspace 键调用
- [x] 3.4 `CreateApp.tsx` 拆 `BUNDLERS_PRIMARY` / `BUNDLERS_SECONDARY` 两个常量
- [x] 3.5 `CreateApp.tsx` 加 `bundlerLevel: 'primary' | 'secondary'` state
- [x] 3.6 处理选中 `__more__` / `__back__` 哨兵值的分支，不调用 `setBundler`
- [x] 3.7 测试：`-b rolldown` 直接跳过 bundler step（不受分层影响）

## 4. PM 选择步骤（#2）

- [x] 4.1 `index.tsx` `create` 命令新增 `--pm <pnpm|yarn|npm>` option（commander）
- [x] 4.2 `actions.ts` 新增 `detectAvailablePMs(): { pnpm: boolean; yarn: boolean; npm: boolean }` 同步 `which` 检测
- [x] 4.3 `CreateApp.tsx` 新增 `pm` state，初始值优先级 `params.pm` → `process.env.DEVKIT_PM` → `undefined`
- [x] 4.4 `CreateApp.tsx` step 序列：`template` → `bundler` → `pm` → `description` → `tasks`
- [x] 4.5 `pm` step 渲染：用 `Select` 列出 pnpm/yarn/npm，未检测到的项 `disabled` 并加 `(未安装)` 后缀
- [x] 4.6 `installDeps(targetDir, opts?: { pm?: 'pnpm'|'yarn'|'npm' })` 签名扩展，向 `PackageManager` 构造透传 `forcePackageManager`
- [x] 4.7 `Done.tsx` 接收 `pm` prop，根据 PM 渲染 `pnpm dev` / `yarn dev` / `npm run dev`
- [x] 4.8 `legacyCreate`（非 TTY）补 enquirer prompt，列表与可用性检测一致；支持 `--pm` 与 `DEVKIT_PM`
- [x] 4.9 `creator.ts` 接受 `pm` 选项透传到 `installDeps`

## 5. 验证 / 回归

- [x] 5.1 跑 `pnpm test` 38 个单测全过
- [x] 5.2 真 TTY 跑 `tsx ./index.tsx create demo-1 -t react-ts -b vite` 通过 4 步交互完成
- [x] 5.3 `tsx ./index.tsx create demo-2 -t vue3-ts -b webpack --pm pnpm` 跳过 PM 步骤
- [x] 5.4 `DEVKIT_PM=npm tsx ./index.tsx create demo-3 -t react-js -b rspack` 跳过 PM 步骤、Done 视图显示 `npm run dev`
- [x] 5.5 `DEVKIT_NO_INK=1 tsx ./index.tsx create demo-4 -t react-ts -b vite` legacy 路径 enquirer prompts 完整
- [x] 5.6 检查 4 个生成项目的 `package.json.scripts` 仅有 3 个 key
- [x] 5.7 `openspec validate polish-create-ux --strict` 通过

## 6. 文档与 changeset

- [x] 6.1 写 `.changeset/polish-create-ux.md`，标记为 minor，列出新增 `--pm` / `DEVKIT_PM` / 分层 UI / 模板 scripts 精简
- [x] 6.2 在 changeset 中明确"已存在的项目模板不受影响，仅新建项目脚本变化"
