## Context

`@bundlekit/cli` 创建项目时使用 EJS 渲染模板生成 `package.json`，模板里硬编码了内部包的语义化版本号（`^0.0.1` / `^1.0.0`）。但：

1. `@bundlekit/service` / `@bundlekit/plugin-*` / `@bundlekit/bundler-*` 至今未发布到 npm registry
2. 模板版本号永远落后于本地 monorepo 实际版本
3. 用户在 monorepo 内（contributors 调试 cli 时）和 monorepo 外（外部用户）的依赖处理需求不同
4. 项目缺少完整的开发者贡献入口与发版流程文档

业界对照：
- **Rsbuild / Rspack / Modern.js**（同类多打包器抽象 + monorepo + 脚手架的项目）选用 **workspace 协议**：模板源码用 `workspace:^`，pnpm publish 时自动转换
- **create-vite / create-vue / Storybook** 选用"模板固定版本 + 发版同步脚本"
- **create-next-app / create-astro** 选用"runtime fetch latest from npm registry"
- **Angular CLI / NestJS CLI** 选用"cli 自身版本作为锚（lockstep）"

工作流选型考量：
- pnpm 生态 + monorepo + lockstep 发版，**Rsbuild 路径（workspace 协议）最匹配**
- pnpm publish 自带 `workspace:^` → `^x.y.z` 转换，发版流程零成本
- 模板源码极简（一行 `workspace:^`），不需要发版后跑 sync 脚本

约束：
- 必须支持 `monorepo dev`（contributors 跑 cli 时用 link 协议秒级 install）
- 必须支持 `npm 发版后用户 install`（用户拿到 tarball 已是固定版本）
- 必须支持 `监听 unpublished 状态`（包未发布时给清晰提示而不是无限 hang）
- 不引入新依赖（pnpm 已是必选 PM）
- 不破坏已归档 change 的 spec（cli-create 已被 polish-create-ux / improve-cli-ux / refactor-bundler-deps 多次 modified，本次再 modify 描述）

## Goals / Non-Goals

**Goals:**
- 4 个 EJS 模板的 `@bundlekit/*` 内部包改用 `workspace:^`
- cli 在生成 `package.json` 后规范化 `workspace:^`：monorepo 内→`link:`，外→`^cliVersion`
- `addBundlerToDevDeps` 行为同款一致
- plugin-react / plugin-vue 版本归一到 `0.0.1`
- docs 加完整的开发者贡献体系（6 个新文件）
- 修订 publish-npm.yml + changeset config 一致性
- 文档站讲清楚 npm publish + GitHub Actions 自动化的步骤

**Non-Goals:**
- 不实现"runtime fetch latest from npm registry"备选路径（路径 B）
- 不实现交互式 prompt 让用户输入 monorepo 路径（保持简单：自动检测或环境变量）
- 不立刻发版到 npm（只准备好流程，何时按 publish 由维护者决定）
- 不改 `add-release-toolchain` 已归档 change 的 spec（commitlint / husky 等独立）
- 不支持 yarn workspace（pnpm-only，与 polish-create-ux 已确立的 PM 选项一致）
- 不动 service / bundler 运行时

## Decisions

### D1：模板中 `@bundlekit/*` 内部包用 `workspace:^`

模板源码的 `package.json.ejs`：
```ejs
"devDependencies": {
    "@bundlekit/service": "workspace:^",
    "@bundlekit/plugin-react": "workspace:^",
    "@bundlekit/bundler-vite": "workspace:^",
    "react": "^18.2.0",          ← 真实 npm 包保留 caret
    "rimraf": "^5.0.1"
}
```

为什么用 `workspace:^` 而不是 `workspace:*`：
- `workspace:^` → publish 时变成 `^x.y.z`（带 caret）
- `workspace:*` → publish 时变成 `x.y.z`（无 caret，过严）
- 我们想要用户能拿到 patch / minor 升级，所以 `^`

### D2：cli 在 generator 之后跑 `normalizeDeps`

不在模板里直接写 `link:` 或 `^cliVersion`，而是先全部写 `workspace:^`，再由 cli 在 `actions.ts` 内调一个 `normalizeDeps(targetDir, depMode)` 步骤把 `workspace:^` 替换为最终值。

为什么：
- 模板源码保持 pnpm 标准约定（IDE / lint 不报错）
- cli 控制替换时机与策略，集中一处
- 发版后这个 normalize 步骤变成"replace `workspace:^` with `^${cliVersion}`"，逻辑统一

```
                      cli 创建流程
                            │
                            ▼
                renderTemplates(generator + ejs)
                            │
                生成的 package.json 含 "workspace:^"
                            │
                            ▼
                  normalizeDeps(targetDir, depMode)
                ┌─────────────┴────────────────┐
                │                              │
            depMode.kind === 'link'      depMode.kind === 'npm'
                │                              │
        替换为 "link:/abs/path"            替换为 "^cliVersion"
                │                              │
                └─────────────┬────────────────┘
                              ▼
                     installDeps + 后续步骤
```

### D3：依赖模式（IDepMode）的判定逻辑

```ts
function resolveDepMode(cwd: string, cliVersion: string): IDepMode {
    // 1. 环境变量优先（CI / 测试旁路）
    const envMode = process.env.DEVKIT_DEP_MODE;
    if (envMode === 'link' && process.env.DEVKIT_MONOREPO_ROOT) {
        return { kind: 'link', monorepoRoot: process.env.DEVKIT_MONOREPO_ROOT, cliVersion };
    }
    if (envMode === 'npm') {
        return { kind: 'npm', cliVersion };
    }
    // 2. 自动检测 monorepo
    const monorepo = findMonorepoRoot(cwd);
    if (monorepo) {
        return { kind: 'link', monorepoRoot: monorepo, cliVersion };
    }
    // 3. 默认 npm 模式
    return { kind: 'npm', cliVersion };
}
```

`findMonorepoRoot` 双重判定（避免误判其他 monorepo）：
- 存在 `pnpm-workspace.yaml`
- 存在 `packages/bundlekit-service` 子目录

### D4：plugin-react / plugin-vue 版本归一

当前：
- @bundlekit/cli, service, shared-utils, bundler-* 都是 `0.0.1`
- @bundlekit/plugin-react, plugin-vue 是 `1.0.0`（早期写错）
- @bundlekit/plugin-mock, request 各自版本

把 plugin-react / plugin-vue 降到 `0.0.1`，跟其他包对齐。首次发版时由 changeset 一并 bump 到 `0.1.0`，对外用户看到的所有 `@bundlekit/*` 都是 `0.1.0`，符合预期。

风险：版本回退（1.0.0 → 0.0.1）不符合 semver，但这两个包从未发布过，无外部依赖，安全。

### D5：开发者贡献文档结构

```
docs/contributing/
├── index.md            贡献流程总览（fork / branch / PR / review / release）
├── setup.md            本地 dev 环境（git clone / pnpm install / build:all）
├── testing.md          unit / integration / e2e 三档测试 + Playwright 安装
├── adding-bundler.md   新增 bundler 适配器步骤（IBuildToolAdapter / 注册 / 测试）
├── adding-plugin.md    新增构建 plugin 步骤（PluginAPI / framework 字段约定）
└── release.md          changeset 工作流 + GitHub Actions 配置
```

`.dumirc.ts` 加导航：
```ts
nav: [
    ...,
    { title: '贡献', link: '/contributing' },
],
sidebar: {
    '/contributing': [
        { title: '总览', link: '/contributing' },
        { title: '环境搭建', link: '/contributing/setup' },
        ...
    ],
}
```

### D6：CI 配置完善（GitHub Actions + changeset）

现状已有 `.github/workflows/publish-npm.yml` 调 `changesets/action@v1`，差几个点：

1. `.changeset/config.json` 的 `baseBranch` 是 `main` 但 workflow 监听 `master` → 改成 `master`
2. workflow 缺 `NPM_TOKEN` env：
   ```yaml
   env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```
3. publish 前缺测试守门：
   ```yaml
   - run: pnpm test
   - run: pnpm test:integration
   ```
4. release.md 文档说明：
   - 维护者在 GitHub repo Settings → Secrets 加 `NPM_TOKEN`（npm Automation token）
   - 维护者在 npm 上为 `@bundlekit` scope 配置 publish 权限
   - 写 changeset：`pnpm changeset` 启交互式
   - 推到 master 后 changesets/action 自动创建 "Version Packages" PR
   - 合并 PR 后 action 自动 publish 到 npm

### D7：发布前的版本统一时机

我们不在本 change 内自动跑 publish，但要把"发布前的版本统一动作"沉淀为一条可执行清单（在 release.md 里）：

1. 全包版本统一为 `0.0.1`（本 change 内完成）
2. `pnpm changeset` 写一条 minor changeset：`@bundlekit/*` minor → 触发 0.1.0 首发
3. master 分支等 changesets/action 创建 PR
4. 维护者 review PR、merge、自动 publish

第一次发版后，cli 创建项目时 normalizeDeps 走 npm 模式（cliVersion = 0.1.0），生成的 `^0.1.0` 能从 npm 拉到。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| `workspace:^` 在用户最终 `package.json` 残留导致 install 失败 | normalizeDeps 步骤兜底；增加单测确保零残留 |
| monorepo 检测误判（其他无关 monorepo 含同名 packages 目录） | 双重判定（`pnpm-workspace.yaml` + `packages/bundlekit-service`） |
| `link:/abs/path` 路径含中文 / 空格 | path.normalize + 测试覆盖 |
| 生成的项目 `link:` 后用户复制到别的机器，路径失效 | docs 在 link 模式下输出警告；release.md 告诉用户"link 仅本地有效，发版后 normalize 自动切 npm 模式" |
| plugin-react / plugin-vue 版本回退被人感知 | 这两个包从未发布到 npm，无外部依赖；changeset 注释说明"首发对齐版本号" |
| GitHub Action publish 流程在没有 NPM_TOKEN 时失败 | release.md 第一段就说明 NPM_TOKEN 配置步骤；workflow 加 readiness check |
| `baseBranch: master` 修改后旧 changeset PR 可能不一致 | 一次性切换；旧 PR 可手动 rebase |
| pnpm publish 转换 workspace:^ 在 npm 上"看不出"（用户也不知道差别） | docs 在 release.md 解释 pnpm 的转换机制 |

## Migration Plan

### Phase 1：核心代码改动（不可拆）

1. `findMonorepoRoot` / `resolveDepMode` / `normalizeDeps` 实现
2. 4 个模板 ejs 改 `workspace:^`
3. `actions.ts` / `creator.ts` 集成 normalizeDeps
4. `addBundlerToDevDeps` 同款集成
5. plugin-react / plugin-vue 版本归一
6. 单测（depMode + normalizeDeps）

### Phase 2：验证

1. monorepo 内：`pnpm exec dc create demo -t react-ts`
   - 验证生成的 `package.json` 含 `link:` 不含 `workspace:^`
   - `pnpm install` 秒级跑通
   - `pnpm dev` 能起服务
2. monorepo 外：`DEVKIT_MONOREPO_ROOT=/none DEVKIT_DEP_MODE=npm dc create demo`
   - 生成 `^0.0.1`（暂时跑不通因为 npm 上没包，但能验证替换逻辑）
3. 集成测试（fixture 已用 link: 协议，应该零回归）

### Phase 3：docs

1. `docs/contributing/` 6 个文件
2. `.dumirc.ts` 导航 + sidebar
3. `docs/guide.md` / `cli.md` 同步
4. `pnpm --filter bundlekit-cli-docs run docs:build` 验证无 broken link

### Phase 4：CI 配置

1. `.changeset/config.json` `baseBranch` 改 `master`
2. `.github/workflows/publish-npm.yml`：加 NPM_TOKEN env + 测试 step
3. release.md 写完整 secret 配置步骤

### Phase 5：changeset

1. `.changeset/adopt-workspace-protocol-templates.md`：minor，对所有受影响包打标
2. `openspec validate adopt-workspace-protocol-templates --strict` 通过

### 回滚

每个 Phase 独立 revert：
- Phase 1 的代码改动是单 commit
- Phase 3 是文档（无 code 影响）
- Phase 4 是 CI（不影响 dev）
- 本 change 不引入运行时副作用，回滚成本低

## Open Questions

- **首发版本号是 `0.1.0` 还是 `1.0.0`？** 0.1.0 表示 pre-1.0 不稳定，1.0.0 暗示 API 稳定。建议 `0.1.0`，给后续做 BREAKING 留余地
- **npm scope `@bundlekit` 是否可用？** 需要去 npmjs.org 查，如果被占用要换成 `@bundle-bundlekit` 或 `@harhao-bundlekit`。本 change 假定可用，发版前需维护者确认
- **GitHub Actions 用 `pnpm/action-setup@v4` 还是 `v2`？** 现 workflow 用 v4，保持
- **release.md 是否包含 OpenSpec workflow？** 建议作为附录，让 contributors 知道每个新 feature 应该开 change
