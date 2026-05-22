## 1. shared-utils 加 IDepMode 类型

- [x] 1.1 在 `lib/types/cli-init/index.ts` 加 `IDepMode` 接口（`kind: 'link' | 'npm'`、`monorepoRoot?: string`、`cliVersion: string`）
- [x] 1.2 export `IDepMode` 与 `DEP_MODE_ENV_KEYS`（`DEVKIT_DEP_MODE` / `DEVKIT_MONOREPO_ROOT`）

## 2. cli 端依赖模式 helpers

- [x] 2.1 新增 `packages/bundlekit-cli/lib/utils/depMode.ts`：实现 `findMonorepoRoot(cwd): string | null`（双重判定 pnpm-workspace.yaml + packages/bundlekit-service）
- [x] 2.2 同文件实现 `resolveDepMode(cwd, cliVersion): IDepMode`（env > monorepo 检测 > npm 兜底）
- [x] 2.3 同文件实现 `normalizeDeps(targetDir, depMode): void`：读 package.json，把所有 `workspace:^` 替换为 link/^ver，写回
- [x] 2.4 单测 `__tests__/depMode.test.ts`：findMonorepoRoot 各场景、resolveDepMode 决策树、normalizeDeps 替换正确性 + 零残留

## 3. 集成到 create 流程

- [x] 3.1 `actions.ts`：`renderTemplates` 后调 `normalizeDeps(targetDir, depMode)`
- [x] 3.2 `actions.ts`：`addBundlerToDevDeps` 签名加 `depMode: IDepMode`，按模式生成 link 或 ^ver
- [x] 3.3 `CreateApp.tsx`：在 task 链开头调 `resolveDepMode`，把结果透传到 renderTemplates / injectBundlerToDeps
- [x] 3.4 `creator.ts`（legacy 路径）：同款集成
- [x] 3.5 `Done.tsx` 信息面板新增"依赖模式"字段（link / npm）
- [x] 3.6 单测 `__tests__/normalizeDeps.test.ts`：mock fs 验证 link 模式 / npm 模式各自输出

## 4. 模板 ejs 改用 workspace:^

- [x] 4.1 `template-react-ts/package.json.ejs`：`@bundlekit/service` / `@bundlekit/plugin-react` / `@bundlekit/bundler-*` 改 `workspace:^`
- [x] 4.2 `template-react-js/package.json.ejs` 同款
- [x] 4.3 `template-vue3-ts/package.json.ejs` 同款（含 `@bundlekit/plugin-vue`）
- [x] 4.4 `template-vue3-js/package.json.ejs` 同款
- [x] 4.5 验证：手工渲染 4 个模板，确认未经 normalizeDeps 时含 `workspace:^`，经 normalizeDeps 后零残留

## 5. plugin 包版本归一

- [x] 5.1 `packages/bundlekit-plugin-react/package.json` version 从 `1.0.0` 改 `0.0.1`
- [x] 5.2 `packages/bundlekit-plugin-vue/package.json` version 从 `1.0.0` 改 `0.0.1`
- [x] 5.3 全 monorepo grep `^"version":` 验证 `@bundlekit/cli` / `@bundlekit/service` / `@bundlekit/shared-utils` / `@bundlekit/bundler-*` / `@bundlekit/plugin-*` 均为 `0.0.1`

## 6. 集成测试覆盖

- [x] 6.1 `__tests__/integration/cli-create.test.ts`：在 monorepo 内创建 → 断言生成的 package.json 含 link、不含 workspace、可 install
- [x] 6.2 同文件：`DEVKIT_DEP_MODE=npm` 创建 → 断言生成的 package.json 含 `^cliVersion`、不含 workspace
- [x] 6.3 跑 `pnpm test` + `pnpm test:integration` 全过

## 7. 开发者贡献文档

- [x] 7.1 创建 `packages/bundlekit-docs/docs/contributing/index.md`：贡献流程总览（fork → branch → develop → test → PR → review → release）
- [x] 7.2 创建 `docs/contributing/setup.md`：本地 dev 环境（git clone / pnpm install / pnpm build:all / 包级脚本）
- [x] 7.3 创建 `docs/contributing/testing.md`：unit / integration / e2e 三档测试 + Playwright 安装 + 测试矩阵
- [x] 7.4 创建 `docs/contributing/adding-bundler.md`：IBuildToolAdapter 接口 + 注册 + 测试 fixture 写法
- [x] 7.5 创建 `docs/contributing/adding-plugin.md`：PluginAPI / framework 字段 / 模板目录约定
- [x] 7.6 创建 `docs/contributing/release.md`：changeset 流程 + GH Action 配置 + NPM_TOKEN 设置步骤
- [x] 7.7 修改 `.dumirc.ts`：nav 加 `贡献` 入口、sidebar 配置 `/contributing` 路径

## 8. 现有 docs 同步

- [x] 8.1 `docs/guide.md`：在"快速开始"section 区分 monorepo dev / 全局 cli 两条路径
- [x] 8.2 `docs/guide/cli.md`：新增"为什么生成的 package.json 含 link:"FAQ section
- [x] 8.3 `docs/index.md`（如适用）：在 hero / quickstart 中补 monorepo 用户的 pnpm install --ignore-workspace 命令
- [x] 8.4 跑 `pnpm --filter bundlekit-cli-docs run docs:build`：无 broken link / 无 dumi error

## 9. CI / changeset 配置完善

- [x] 9.1 `.changeset/config.json`：`baseBranch` 从 `main` 改 `master`
- [x] 9.2 `.github/workflows/publish-npm.yml`：在 build 之后、changesets/action 之前加 `pnpm test` + `pnpm test:integration` 步骤
- [x] 9.3 同 workflow：在 `changesets/action@v1` step 加 `env.NPM_TOKEN: ${{ secrets.NPM_TOKEN }}`
- [x] 9.4 文档 `release.md` 写明 NPM_TOKEN 配置步骤（npm 上生成 Automation token → GitHub repo Settings → Secrets → New repository secret）
- [x] 9.5 文档 `release.md` 解释 changeset workflow（`pnpm changeset` 写 → push master → action 自动创建 Version Packages PR → merge → action 自动 publish）

## 10. publishConfig 与 files 字段审计

- [x] 10.1 `@bundlekit/cli` 检查 `publishConfig.registry` + `files` 字段（应只含 dist + bin）
- [x] 10.2 `@bundlekit/service` 同款
- [x] 10.3 `@bundlekit/shared-utils` 同款
- [x] 10.4 `@bundlekit/bundler-{webpack,vite,rspack,rollup,rolldown}` 同款
- [x] 10.5 `@bundlekit/plugin-{react,vue}` 同款（注意 plugin 包要含 templates/ 目录）
- [x] 10.6 跑 `pnpm pack --dry-run` 在每个包验证 tarball 不含 src / __tests__ / scripts 等 dev 文件

## 11. changeset

- [x] 11.1 写 `.changeset/adopt-workspace-protocol-templates.md`，标记所有受影响包为 `minor`，包括 `@bundlekit/cli`、`@bundlekit/plugin-react`（version bump 从 1.0.0 回退到 0.1.0 时单独说明）、`@bundlekit/plugin-vue` 同款

## 12. 验证 / 回归

- [x] 12.1 真终端跑 `pnpm exec dc create demo-link -t react-ts -b vite --pm pnpm`：生成项目含 link:、`pnpm install --ignore-workspace` 秒级、`pnpm dev` 起服务
- [x] 12.2 真终端跑 `DEVKIT_DEP_MODE=npm dc create demo-npm -t vue3-ts -b webpack`：生成项目含 `^0.0.1`（暂不能 install 因为没发版）
- [x] 12.3 跑 38 unit + 20 integration + 1 e2e 全过
- [x] 12.4 `openspec validate adopt-workspace-protocol-templates --strict` 通过
