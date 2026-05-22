---
title: 发版流程
order: 6
---

# 发版流程（changeset + GitHub Actions）

bundlekit 用 [Changesets](https://github.com/changesets/changesets) 管理版本与 changelog，配合 GitHub Actions 自动 npm publish。

## 工作流概览

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   开发者                              CI / GitHub Actions       │
│   ─────────                           ─────────────────────────  │
│                                                                 │
│   1. 改代码                                                      │
│   2. pnpm changeset                                              │
│      （写一条 markdown 说明）                                     │
│   3. git commit + push                                           │
│   4. 提 PR                                                       │
│                                                                  │
│      └─ PR 合并到 master                                          │
│                                       │                          │
│                                       ▼                          │
│                            5. publish-npm.yml 触发               │
│                            6. install + build + test             │
│                            7. changesets/action 检测：           │
│                               - 有未发布的 changeset             │
│                                 → 创建 / 更新 "Version           │
│                                   Packages" PR                   │
│                               - 无未发布 changeset               │
│                                 → 不动                           │
│                                                                  │
│   8. 维护者 review "Version Packages" PR                         │
│      （检查 version bump + changelog）                            │
│   9. 合并 PR                                                     │
│                                       │                          │
│                                       ▼                          │
│                           10. publish-npm.yml 再次触发            │
│                           11. changesets/action 检测：           │
│                               - 没有未发布 changeset             │
│                                 → 跑 pnpm changeset publish      │
│                                 → 推 tarball 到 npm registry     │
│                                 → 创建 GitHub release           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

核心机制：**两次 push 触发，第一次开 PR，第二次 publish**。

## 写 Changeset

每个 PR 至少要有一条 changeset 描述本次变更：

```bash
pnpm changeset
```

交互式问答：

1. **Which packages would you like to include?**
   按空格选要 bump 的 `@bundlekit/*` 包。一般来说改了哪个包就选哪个。

2. **Which packages should have a major bump?**
   有 BREAKING change 才选。绝大多数情况跳过（默认 patch）。

3. **Which packages should have a minor bump?**
   新增功能选。

4. **Summary**
   写一段 markdown 说明，会作为 changelog 内容。例：

   ```
   Added Svelte framework plugin (@bundlekit/plugin-svelte) with templates for
   svelte-ts and svelte-js. Each bundler adapter (vite/webpack/rspack)
   recognizes `framework: 'svelte'` and injects appropriate loaders.
   ```

会在 `.changeset/<random-name>.md` 生成。前面 yaml 是受影响包+bump 类型，后面是 markdown 说明。

```markdown
---
"@bundlekit/plugin-svelte": minor
"@bundlekit/cli": minor
"@bundlekit/shared-utils": minor
---

Added Svelte framework plugin ...
```

## changeset config 关键字段

`.changeset/config.json`：

```json
{
    "changelog": "@changesets/cli/changelog",
    "commit": false,
    "fixed": [],
    "linked": [],
    "access": "public",
    "baseBranch": "master",
    "updateInternalDependencies": "patch",
    "ignore": []
}
```

- `access: "public"` — `@bundlekit/*` scope 包默认私有，必须显式开公开
- `baseBranch: "master"` — 与 GitHub Actions workflow `on.push.branches` 必须一致
- `updateInternalDependencies: "patch"` — 当 A 包升级时，依赖它的 B 包自动 bump patch（即使 B 没改代码）

## GitHub Actions Workflow

`.github/workflows/publish-npm.yml`：

```yaml
name: publish-npm

on:
  push:
    branches:
      - master

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # 必须，changeset 需完整 git history

      - uses: pnpm/action-setup@v4
        with:
          version: 8.15.9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm build:all
      - run: pnpm test
      - run: pnpm test:integration

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          title: 'chore: version packages'
          commit: 'chore: version packages [skip ci]'
          publish: pnpm changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 配置 GitHub Secrets

### 1. NPM_TOKEN

#### a. 生成 npm Automation Token

1. 登录 https://www.npmjs.com
2. 头像菜单 → Access Tokens
3. Generate New Token → **Granular Access Token**（推荐）或 Classic → Automation
4. 配置：
   - Token name: `bundlekit-ci`
   - Expiration: 1 年（到期前要轮换）
   - Packages: 选 `@bundlekit/*` scope（首次发布时这个 scope 需先在 npm 上 owner 占领）
   - Permissions: Read and write
5. Generate → 复制 token（只显示一次！）

#### b. 添加到 GitHub Secrets

1. 仓库 Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `NPM_TOKEN`
4. Value: 粘贴步骤 a 的 token
5. Add secret

### 2. GITHUB_TOKEN

不需要手工配。GitHub Actions 自动注入 `secrets.GITHUB_TOKEN`，权限由 workflow `permissions:` 字段控制。

确保 workflow 包含：

```yaml
permissions:
  contents: write       # 允许创建 commit / tag / release
  pull-requests: write  # 允许创建 / 更新 Version Packages PR
```

仓库 Settings → Actions → General → Workflow permissions 也要选 "Read and write permissions"。

### 3. 验证配置

在 master 分支随便 push 一个 commit（无 changeset 也行），workflow 会跑：

- 没 changeset → 不创建 PR，没动作
- 有 changeset → 创建 "Version Packages" PR

## 首次发布 checklist

第一次往 npm 发的时候特别小心。流程：

### 1. npm scope 占领

```bash
# 登录 npm
npm login

# 创建 organization（如果还没有）
# 在 https://www.npmjs.com/org/create 创建 @bundlekit org
# 或者改为个人 scope：@<your-username>
```

如果 `@bundlekit` scope 被别人占了，需要把所有包名改成 `@<your-name>-bundlekit/...`。改：

- 各 `package.json` 的 `name`
- `BUNDLER_PACKAGE_MAP`
- 模板里的依赖名
- 所有文档中的 import 示例

### 2. 包元数据审计

每个要发的 `@bundlekit/*` 包检查：

```bash
cd packages/bundlekit-cli
pnpm pack --dry-run

# 看输出的 file list：
#   - 应只含 dist/ + package.json + bin/ + README.md（如有）
#   - 不应含 src/ / lib/ / __tests__/ / scripts/ / node_modules/
```

如果有不该 ship 的文件，修 `package.json` 的 `files`：

```json
{
    "files": ["dist", "bin"]
}
```

### 3. 第一波 changeset

```bash
pnpm changeset

# 选所有受影响包（首发就是全部）
# 选 minor（0.0.1 → 0.1.0；建议 0.1.0 而非 1.0.0，给 BREAKING 留余地）
# 写说明：Initial public release
```

### 4. 推到 master

```bash
git add .changeset/
git commit -m "chore: prepare initial release"
git push origin master
```

GitHub Actions 会创建 "Version Packages" PR。

### 5. Review + Merge

review PR：
- 确认所有 `@bundlekit/*` 都 bump 到 `0.1.0`
- 确认 changelog 内容正确
- 确认 `package.json.version` 字段更新一致

merge PR。

### 6. 自动 publish

merge 触发 workflow 跑 `pnpm changeset publish`：

- 推 tarball 到 npmjs.org
- 创建 git tag `@bundlekit/cli@0.1.0` 等
- 创建 GitHub release（如配置了 changelog 集成）

### 7. 验证

```bash
npm view @bundlekit/cli
# 应看到 version: 0.1.0
```

往后用户可以 `npm install -g @bundlekit/cli@0.1.0` 拉到。

### 8. 同步 cli 模板

由于 cli 模板用 `workspace:^` 协议，pnpm publish 时已自动转换为 `^0.1.0`。但如果有 npm 版本号注入的位置（如 `addBundlerToDevDeps` 用 `^${cliVersion}`），需确认 cli 自身的 `package.json.version` 也是 `0.1.0` —— changeset 自动处理。

## 后续迭代

```bash
# 修了一个 bug
pnpm changeset
# 选受影响包 + patch + 写说明
git push

# 维护者 merge "Version Packages" PR

# 自动 0.1.1 publish
```

## 常见问题

### Q: 我提了 PR 但忘了写 changeset

CI 中加 `changeset/check-action`：

```yaml
- name: Check changeset
  uses: changesets/action@v1
  with:
    setupGitUser: false
```

但这是软性提示，PR 仍能通过。建议写 PR 模板要求 contributor 自己加 changeset。

### Q: workspace:^ 在发布的 tarball 里是什么？

pnpm publish 自动转换：

```json
// 源 package.json
"@bundlekit/service": "workspace:^"

// 发到 npm 后的 package.json
"@bundlekit/service": "^0.1.0"
```

转换基于当前 `@bundlekit/service` 在 monorepo 里的版本号。

### Q: 我想跳过 CI 直接手工发版

```bash
# 本地切到 master
git checkout master && git pull

# 跑 changeset version（更新所有 package.json + 写 CHANGELOG）
pnpm changeset version

# review 改动
git diff

# commit
git add . && git commit -m "chore: version packages"

# 推 master
git push

# 手工 publish
NPM_TOKEN=<token> pnpm changeset publish
```

但**强烈推荐用 CI 自动发版**，避免漏 build / 漏测试。

### Q: 发错了版本怎么办

```bash
# npm 不允许覆盖发布同一版本号，但允许 deprecate
npm deprecate @bundlekit/cli@0.1.0 "Bad release, use 0.1.1"

# 然后修 bug + 再发新版本
```

### Q: 紧急安全发版

```bash
# 写 changeset 时选 patch
pnpm changeset
# 注意 summary 要明确写 "Security fix"

# 跳过常规 review 流程，让维护者直接 merge "Version Packages" PR
```

## 工具对比

| 工具 | 选用了吗 | 备注 |
|---|---|---|
| changeset | ✅ | 主版本管理 |
| changesets/action | ✅ | GitHub Actions 集成 |
| semantic-release | ❌ | 太黑盒，与 monorepo 集成复杂 |
| lerna | ❌ | 现代仓库改用 pnpm + changeset |
| nx release | ❌ | 主要为 nx 仓库设计 |
