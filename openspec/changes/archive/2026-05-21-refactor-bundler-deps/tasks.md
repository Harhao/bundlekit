## 1. shared-utils: confirm 工具

- [x] 1.1 在 `packages/devkit-shared-utils/lib/shared/` 新增 `confirm.ts`，导出 `confirm({ message, default? }): Promise<boolean>`，基于 `enquirer` 实现
- [x] 1.2 `confirm` 内部判定 `process.stdout.isTTY` 与 `process.env.DEVKIT_NO_PROMPT`，非交互场景返回 `default ?? false`
- [x] 1.3 在 `packages/devkit-shared-utils/lib/shared/index.ts` 导出 `confirm`
- [x] 1.4 单测：在 `__tests__` 下覆盖 TTY / 非 TTY / DEVKIT_NO_PROMPT 三个分支

## 2. shared-utils: 类型 & 常量

- [x] 2.1 新增 `lib/types/cli-init/` 中 `BUNDLER_PACKAGE_MAP` 常量类型，列出 `webpack|vite|rspack|rollup|rolldown → @devkit/bundler-*`
- [x] 2.2 导出 `BUNDLER_PACKAGE_MAP` 与配套 `IBundlerName` 类型，供 cli 与 service 共享

## 3. service: 移除 bundler-* 依赖

- [x] 3.1 修改 `packages/devkit-service/package.json`：从 `dependencies` 移除 5 个 `@devkit/bundler-*`
- [x] 3.2 同文件新增 `peerDependencies` 与 `peerDependenciesMeta`，5 个 bundler 全部 `optional: true`
- [x] 3.3 验证 `pnpm install` 在 monorepo 仍能解析（workspace 链接保持）

## 4. service: 改造 startBuilder 流

- [x] 4.1 在 `Service.ts` 顶部 import `confirm`、`BUNDLER_PACKAGE_MAP`
- [x] 4.2 抽出 `resolveBundlerOrPrompt(packageName: string): Promise<boolean>` 私有方法：先 `loadBundlerPlugin`，失败则按 `D2` 决策的策略矩阵决定 confirm / 报错 / 自动安装
- [x] 4.3 把 `startBuilder` 中的 `pm.add(packageName, { noSave: true })` 路径替换为调用 `resolveBundlerOrPrompt`
- [x] 4.4 引入两个环境变量旁路：`DEVKIT_NO_PROMPT`、`DEVKIT_AUTO_INSTALL`
- [x] 4.5 用户拒绝 / 安装失败时，输出包含 `devkit-cli add bundler-<name>` 引导文案，`process.exit(1)`
- [x] 4.6 用户接受时，`pm.add(packageName, { dev: true })` 安装，写入 `devDependencies`，安装后重新 `loadBundlerPlugin` 并继续构建

## 5. cli: create 写入 devDependencies

- [x] 5.1 在 `creator.ts` 中新增 `writeBundlerToDevDeps(targetDir, bundler, version)` 步骤：在 install 前修改 `package.json`
- [x] 5.2 cli 渲染模板时把所选 bundler 注入 `package.json.ejs`（让 `devDependencies` 中包含一行 `"@devkit/bundler-<%= bundler %>": "<%= bundlerVersion %>"`），或者直接在生成后用 `fs` 改 package.json — 二选一，design D4 倾向后者
- [x] 5.3 版本号由 `cli/package.json` 的 `dependencies` 中查到（同时把 cli 自身 deps 也补上 5 个 `@devkit/bundler-*` 仅用于版本范围声明）
- [x] 5.4 同步更新 `packages/devkit-plugin-react/templates/template-react-{ts,js}/package.json.ejs` 与 `template-vue3-{ts,js}`：去除（如果有）写死的 bundler 行，改由 cli 注入
- [x] 5.5 验证 `dc create demo -b vite` 后 demo 项目的 package.json 含 `@devkit/bundler-vite`，且无其他 bundler

## 6. cli: add 命令支持 bundler 短名

- [x] 6.1 在 `lib/commands/add/index.ts` 中新增 `BUNDLER_MAP` 常量，引用 shared-utils 的 `BUNDLER_PACKAGE_MAP`
- [x] 6.2 改造 `resolvePackageName(input)`：当输入命中 `BUNDLER_MAP` 或 `bundler-*` 前缀时，解析为完整包名
- [x] 6.3 改造 `isBuildPlugin`：bundler 也按 `dev: true` 安装
- [ ] 6.4 验证 `dc add vite`、`dc add bundler-rspack`、`dc add @devkit/bundler-rollup` 三种写法等价
- [x] 6.5 验证 add bundler 后**不**自动调用 generator（与 plugin 区分），只装包

## 7. 模板与发版

- [x] 7.1 在 `cli/package.json` 的 `dependencies` 中显式列出 5 个 `@devkit/bundler-*: workspace:*`（仅用于版本范围 / 发版时被替换为 caret）
- [x] 7.2 在 `turbo.json` 检查 `service:build` 任务是否仍在 `dependsOn` 中传递 bundler 构建依赖；如丢失则显式补回
- [x] 7.3 准备 changeset：标注 BREAKING change，列出迁移指引

## 8. 文档（仅本 change 范围内的最小更新）

- [x] 8.1 在 `packages/devkit-docs/docs/guide/bundlers.md` 顶部加一节 "Bundler 安装方式"，说明三种入口（create/add/runtime prompt）
- [x] 8.2 在 `packages/devkit-docs/docs/guide/cli.md` 的 `add` 章节追加 `bundler-*` 短名表
- [x] 8.3 完整的"安装心智"重写留给 Change 5 处理，本 change 仅做必要的小补丁

## 9. 验证

- [x] 9.1 在 monorepo 内 `pnpm dev`、`pnpm build` 全部 bundler 全部模板组合至少各跑一遍 smoke test
- [ ] 9.2 在 monorepo 外 `pnpm pack` 后 npm install 模拟用户场景，验证 `@devkit/service` install size 显著下降
- [x] 9.3 模拟 CI：`DEVKIT_AUTO_INSTALL=1` 下能跑通；不设变量时报错引导
- [ ] 9.4 模拟用户切 bundler：`pnpm install` 后改 `.devkitrc.ts` 的 `bundler` 字段，运行 `serve` 时被 prompt 安装并能继续
