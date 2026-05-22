## Why

`@bundlekit/service` 当前在 `dependencies` 中硬绑了全部 5 个 bundler 适配器（webpack/vite/rollup/rspack/rolldown），导致用户即使只用 vite 也会被强制下载其他 4 个适配器及其 native 依赖（rspack、webpack、rollup …），安装体积膨胀且违反 service 文档中"运行时按需加载打包器"的设计原则。Service 现有的 fallback 机制（`Service.startBuilder` 在找不到 bundler 时调 `pm.add(pkg, { noSave: true })`）会把包临时装入 `node_modules` 但**不写入** `package.json`，下次启动还要重装，体感差。

## What Changes

- **BREAKING** `@bundlekit/service/package.json` 移除 5 个 `@bundlekit/bundler-*` 的 `dependencies`，标记为 `peerDependenciesMeta.optional: true`。
- `@bundlekit/cli` 的 `create` 命令在生成项目后，根据用户选择的 `-b/--bundler` 把对应的 `@bundlekit/bundler-{name}` 写入新项目的 `devDependencies`，并在 install 阶段一同安装。
- `@bundlekit/cli` 的 `add` 命令扩展 `PLUGIN_MAP`，支持短名 `bundler-webpack` / `bundler-vite` / `bundler-rspack` / `bundler-rollup` / `bundler-rolldown`，按 `devDependencies` 安装。
- `@bundlekit/service` 的 `Service.startBuilder()` 在检测到 bundler 缺失时，**弹出 yes/no 交互提示**：选 yes 调 `packageManager.add(pkg, { dev: true })` 写入项目 `devDependencies`；选 no 输出引导信息并以非零退出码退出。
- `@bundlekit/shared-utils` 新增 `confirm({ message, default })` 工具函数（基于 enquirer），供 service 在非交互或 TTY 环境做判断与回退。
- 文档（`bundlekit-docs/docs/guide/bundlers.md` 与 `cli.md`）更新"按需安装"的真实流程描述。

## Capabilities

### New Capabilities
- `bundler-installation`: 描述 cli 创建/追加 bundler 的语义、service 运行时检测缺失 bundler 的交互行为以及失败语义。

### Modified Capabilities
- `service-core`: 修改 `loadBundlerPlugin` / `startBuilder` 的运行时行为 — 不再静默 `noSave` 安装，改为 confirm 后写入 devDeps 或失败退出。
- `cli-create`: `create` 命令额外把所选 bundler 写入项目 devDependencies。

## Impact

**代码变更**
- `packages/bundlekit-service/package.json`：移除 5 个 bundler-* `dependencies`
- `packages/bundlekit-service/lib/Service.ts`：`startBuilder` 增加 confirm 流
- `packages/bundlekit-cli/lib/commands/create/creator.ts`：写入 devDeps
- `packages/bundlekit-cli/lib/commands/add/index.ts`：扩展 `PLUGIN_MAP`
- `packages/bundlekit-shared-utils/lib/shared/`：新增 `confirm.ts`

**API / 配置**
- `IBuildConfig` 类型不变，纯运行时行为变化
- 用户 lockfile 会减少 4 个 bundler 子树（除其首选 bundler 外）

**风险**
- 老用户升级到新版本后，旧项目 `package.json` 里没有 bundler-*，第一次启动会被 prompt 安装。需在 release notes 标注 BREAKING。
- monorepo `workspace:*` 链接不受影响（dev 时 service 仍能 require.resolve 到 workspace 中的 bundler-*）。
- CI 等无 TTY 环境必须能跳过 prompt（通过环境变量 `DEVKIT_AUTO_INSTALL=1` 或在缺失时直接报错而非交互），需在 design 中明确策略。
