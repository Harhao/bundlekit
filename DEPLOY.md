# DEPLOY — 发版流程

bundle-bundlekit 用 [Changesets](https://github.com/changesets/changesets) + [GitHub Actions](https://docs.github.com/en/actions) 实现自动化 npm publish。本文档记录从零到首发到迭代的完整步骤。

## 工作流概览

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   开发者                                CI / GitHub Actions          │
│   ─────────                             ─────────────────────────    │
│                                                                     │
│   1. 改代码                                                          │
│   2. pnpm changeset                                                  │
│      （选受影响包 + bump 类型 + 写说明）                              │
│   3. git commit + push                                               │
│   4. 提 PR 到 master                                                 │
│                                                                     │
│      └─ PR 合并到 master                                             │
│                                         │                            │
│                                         ▼                            │
│                            5. publish-npm.yml 触发                   │
│                            6. install + build + test                 │
│                            7. changesets/action 检测：                │
│                               - 有未发布的 changeset                  │
│                                 → 创建 / 更新 "Version Packages" PR  │
│                               - 无未发布 changeset                    │
│                                 → 不动                               │
│                                                                     │
│   8. 维护者 review "Version Packages" PR                             │
│      （检查 version bump + CHANGELOG.md）                            │
│   9. 合并 PR                                                         │
│                                         │                            │
│                                         ▼                            │
│                           10. publish-npm.yml 再次触发                │
│                           11. changesets/action 检测无 pending：     │
│                               → pnpm changeset publish               │
│                               → 推 tarball 到 npm registry           │
│                               → 创建 git tag + GitHub release       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

核心机制：**两次 push 触发，第一次开 Version Packages PR，第二次自动 publish**。

---

## 一次性准备（首次发版前做这些）

### 步骤 1：检查 npm scope 可用性

```bash
npm view @bundlekit/cli 2>&1 | head -3
# 期望：404 Not Found（说明 scope 没被占）
```

如果 `@bundlekit` scope 已被别人占，需要把所有 `@bundlekit/*` 包改名（例如改成 `@bundle-bundlekit/*` 或 `@<你的用户名>/bundlekit-*`）。涉及修改：

- 各 `packages/*/package.json` 的 `name`
- `packages/bundlekit-shared-utils/lib/types/cli-init/index.ts` 的 `BUNDLER_PACKAGE_MAP`
- `packages/bundlekit-plugin-*/templates/*/package.json.ejs` 中的 dep 名
- 全部文档（docs / README）中的 import 示例

### 步骤 2：在 npm 创建 organization

访问 https://www.npmjs.com/org/create，新建 `@bundlekit` org（如果是个人 scope 直接用账号 scope 即可）。

### 步骤 3：生成 npm Automation Token

1. 登录 https://www.npmjs.com → 头像菜单 → **Access Tokens**
2. **Generate New Token** → **Granular Access Token**（推荐，更安全）
3. 配置：

   | 字段 | 值 |
   |---|---|
   | Token name | `bundle-bundlekit-ci` |
   | Expiration | 365 天（到期前要轮换） |
   | Packages and scopes | 勾选 `@bundlekit` scope 下全部包 |
   | Permissions | **Read and write** |

4. 点 **Generate**
5. ⚠️ **立即复制 token**，离开页面后无法再查看

> 💡 Classic Token 也行（选 Automation 类型），但 Granular 更精确控权限。

### 步骤 4：在 GitHub 配置 NPM_TOKEN secret

1. 打开仓库 https://github.com/Harhao/bundle-bundlekit → **Settings** 标签
2. 左侧 **Secrets and variables** → **Actions**
3. 点 **New repository secret**
4. 配置：

   | 字段 | 值 |
   |---|---|
   | Name | `NPM_TOKEN` |
   | Secret | 粘贴步骤 3 复制的 token |

5. 点 **Add secret**

> 💡 `GITHUB_TOKEN` 不需要手工配置，GitHub Actions 自动注入。

### 步骤 5：调整 Workflow 权限

仓库 **Settings** → **Actions** → **General** → 拖到底部 **Workflow permissions**：

- ✅ **Read and write permissions**（默认是 read-only，必须改）
- ✅ **Allow GitHub Actions to create and approve pull requests**

否则 `changesets/action` 无法创建 "Version Packages" PR。

### 步骤 6（可选）：配置 PR template 提示写 changeset

新建 `.github/PULL_REQUEST_TEMPLATE.md`：

```markdown
## Summary

<!-- 描述这个 PR 做了什么 -->

## Checklist

- [ ] 跑 `pnpm changeset` 写了 changeset
- [ ] `pnpm test` 通过
- [ ] `pnpm test:integration` 通过
- [ ] 相关文档更新
```

---

## 首次发版流程（0.0.1 → 0.1.0）

bundle-bundlekit 当前所有包是 `0.0.1`，首发推荐 bump 到 `0.1.0`（pre-1.0 不稳定语义，给 BREAKING 留余地）。

### 步骤 1：写第一个 changeset

```bash
cd /path/to/bundle-bundlekit
pnpm changeset
```

交互式问答：

```
?  Which packages would you like to include? ...
   ◯ @bundlekit/cli
   ◯ @bundlekit/service
   ◯ @bundlekit/shared-utils
   ◯ @bundlekit/bundler-vite
   ...
```

按空格全选所有 `@bundlekit/*`（首发就是全部要发）。

```
?  Which packages should have a major bump? ...
```

回车跳过（首发不用 major）。

```
?  Which packages should have a minor bump? ...
```

按空格选所有要 bump 的包（应该是除了已选 major 之外的全部）。

```
?  Please enter a summary for this change ...
```

填："Initial public release"

完成后会生成 `.changeset/<random-name>.md`，里面是受影响包列表 + summary。

### 步骤 2：本地预览

```bash
# 预览 version bump 效果（不实际写盘）
pnpm changeset status
```

输出示例：

```
🦋  Releases:
🦋    @bundlekit/cli@0.1.0 (minor)
🦋    @bundlekit/service@0.1.0 (minor)
🦋    ...
```

### 步骤 3：提交 + 推送

```bash
git add .changeset/
git add .   # 其他改动一起
git commit -m "chore: prepare initial 0.1.0 release"
git push origin master
```

### 步骤 4：等 GitHub Actions 创建 Version Packages PR

打开 https://github.com/Harhao/bundle-bundlekit/actions 看 `publish-npm` workflow：

- 第一波（推 master 触发）：

  ```
  ✓ checkout
  ✓ setup pnpm
  ✓ setup node
  ✓ pnpm install --frozen-lockfile
  ✓ pnpm build:all
  ✓ pnpm test
  ✓ pnpm test:integration
  ✓ changesets/action → 创建 "Version Packages" PR
  ```

PR 名字是 `chore: version packages`，机器人提交。

### 步骤 5：review Version Packages PR

打开 PR，确认：

- ✅ 每个 `@bundlekit/*` 包的 `package.json.version` 从 `0.0.1` 改为 `0.1.0`
- ✅ 根 `CHANGELOG.md` / 各包 `CHANGELOG.md` 内容正确
- ✅ pnpm-lock.yaml 同步更新
- ✅ workspace:^ 协议在生产 build 中被 pnpm 自动转换

如果有问题，**不要直接关 PR**，回到本地改 changeset：

```bash
git checkout changeset-release/master
# 改 .changeset/ 或代码
git push   # PR 会自动更新
```

### 步骤 6：merge Version Packages PR

review 通过 → 点 **Squash and merge**（或 Merge commit）。

### 步骤 7：等自动 publish

PR merge 到 master 触发新一轮 workflow：

- 第二波：

  ```
  ✓ checkout
  ✓ setup pnpm
  ✓ setup node
  ✓ pnpm install --frozen-lockfile
  ✓ pnpm build:all
  ✓ pnpm test
  ✓ pnpm test:integration
  ✓ changesets/action → 检测无 pending changeset
                       → pnpm changeset publish
                       → 推 tarball 到 npm
                       → 创建 git tag @bundlekit/cli@0.1.0 等
                       → 创建 GitHub release
  ```

### 步骤 8：验证

```bash
# 任意目录
npm view @bundlekit/cli
# 期望看到 "version": "0.1.0"

npm view @bundlekit/service
npm view @bundlekit/bundler-vite
npm view @bundlekit/plugin-react
# 全部都应该是 0.1.0
```

也可以打开 https://www.npmjs.com/package/@bundlekit/cli 看 release。

### 步骤 9：试用真实安装路径

```bash
# 全新目录
cd /tmp/bundlekit-test
npm install -g @bundlekit/cli@0.1.0

# 现在外部用户能直接用
dc create my-app -t react-ts -b vite
cd my-app && pnpm install
pnpm dev
```

---

## 后续迭代发版

```bash
# 1. 在 feature 分支改代码
git checkout -b fix/some-bug
# ... 改代码 + 加测试 ...

# 2. 跑测试确认
pnpm test
pnpm test:integration

# 3. 写 changeset
pnpm changeset
# 选受影响的包 + 选 patch（bug fix）/ minor（新功能）
# 写 summary

# 4. commit + push
git add .
git commit -m "fix: some bug"
git push origin fix/some-bug

# 5. 在 GitHub 提 PR 到 master

# 6. PR review + merge → workflow 自动：
#    - 第一波：更新 "Version Packages" PR（如果已存在）
#             或创建新的（如果是第一个 pending changeset）
#    - "Version Packages" PR merge → 第二波自动 publish 新版本
```

---

## 版本号约定

bundle-bundlekit 用 **lockstep 发版**（所有 `@bundlekit/*` 同步 bump），原因：

- cli 创建项目时模板用 `workspace:^` 协议
- pnpm publish 自动把 `workspace:^` 转换为依赖包的实际版本
- 假设所有 `@bundlekit/*` 版本同步，避免 service@0.1.0 拿到 plugin-react@0.0.5 这种错配

```
✓ 正确  → 所有 @bundlekit/* 同时 minor bump（0.1.0 → 0.2.0 全套）
✗ 错误  → 单独把 @bundlekit/plugin-react bump 到 0.5.0
```

如果某个包真有独立大版本号需求（如 plugin-react 跟随 react 主版本），用 `linked` 配置：

```jsonc
// .changeset/config.json
{
    "linked": [["@bundlekit/plugin-react"]]
}
```

但目前 `linked: []`，全部 lockstep。

---

## 配置参考

### `.changeset/config.json`

```json
{
    "$schema": "https://unpkg.com/@changesets/config@3.1.4/schema.json",
    "changelog": "@changesets/cli/changelog",
    "commit": false,
    "fixed": [],
    "linked": [],
    "access": "public",
    "baseBranch": "master",
    "updateInternalDependencies": "patch",
    "ignore": [
        "bundlekit-cli-docs"
    ]
}
```

| 字段 | 含义 |
|---|---|
| `access: "public"` | `@bundlekit/*` scope 包默认 npm 私有，必须显式开 public |
| `baseBranch: "master"` | 与 GitHub Actions `on.push.branches` 必须一致 |
| `updateInternalDependencies: "patch"` | A 包升级时依赖它的 B 包自动 bump patch |
| `ignore: ["bundlekit-cli-docs"]` | docs 站点包不参与发版 |

### `.github/workflows/publish-npm.yml`

```yaml
name: publish-npm

on:
  push:
    branches:
      - master

concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write       # 创建 commit / tag / release
  pull-requests: write  # 创建 / 更新 Version Packages PR

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # ⚠ 必须：changeset 需完整 git history

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

---

## 故障排查 FAQ

### Q: GitHub Actions 报 `EINVALIDTAGNAME` / `403 Forbidden`

NPM_TOKEN 错或权限不够。检查：

1. Token 是否在 npm 上仍有效（去 npmjs.com/settings/<user>/tokens 查）
2. Token 是否对 `@bundlekit` scope 有 read+write 权限
3. GitHub secret name 是否正好是 `NPM_TOKEN`

### Q: workflow 跑了但没创建 "Version Packages" PR

可能原因：

1. **没 changeset**：`.changeset/` 下没有 markdown 文件（除了 `config.json` 和 `README.md`），workflow 不动
2. **权限不够**：仓库 Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests" 没勾
3. **baseBranch 不匹配**：`.changeset/config.json` 的 `baseBranch` 与 workflow `on.push.branches` 不一致

### Q: Version Packages PR merge 后没自动 publish

打开 Actions 看新触发的 workflow：

- 如果 workflow 没触发：检查 master 是否真的有新 commit（PR merge 可能是 rebase 模式，commit 已存在）
- 如果 changesets/action 报错：看具体错误，通常是 NPM_TOKEN 问题
- 如果 changesets/action 跑完但没 publish：检查 `.changeset/` 是否还有 markdown 文件（merge 后应该自动删除）

### Q: 发错了版本号怎么办

```bash
# npm 不允许覆盖发布同一版本，但允许 deprecate
npm deprecate @bundlekit/cli@0.1.0 "Bad release, use 0.1.1"

# 然后立刻发新版修复
pnpm changeset   # 选 patch + 写 "Hotfix for 0.1.0"
git push
```

### Q: workspace:^ 在 npm tarball 里看不到

正常。pnpm publish 自动转换：

```diff
- "@bundlekit/service": "workspace:^"
+ "@bundlekit/service": "^0.1.0"
```

转换基于 monorepo 里 `@bundlekit/service` 当前版本号。

### Q: 紧急绕过 CI 手工发版

不推荐，但应急可用：

```bash
# 切到 master
git checkout master && git pull

# 应用所有 pending changeset
pnpm changeset version

# review 改动
git diff

# commit + push
git add . && git commit -m "chore: version packages"
git push

# 手工 publish
NPM_TOKEN=<your_npm_token> pnpm changeset publish
```

仍会推 git tag 但不会自动建 GitHub release。

### Q: 我想测试 publish 流程但不想真发到 npm

用 [verdaccio](https://verdaccio.org/) 起本地 registry：

```bash
npm install -g verdaccio
verdaccio   # 默认 http://localhost:4873

# 在仓库根目录配置临时 .npmrc
echo "registry=http://localhost:4873/" > .npmrc

# publish 到 verdaccio
NPM_TOKEN=fake-token pnpm changeset publish

# 测完删掉 .npmrc
rm .npmrc
```

### Q: changeset publish 中途失败一半包发了一半没发

`pnpm changeset publish` 是按依赖顺序串行发，失败时已发的不会回滚。处理：

1. 看哪些包成功发了（`npm view @bundlekit/<pkg>` 验）
2. 把失败的包手工发：
   ```bash
   cd packages/bundlekit-<failed>
   NPM_TOKEN=<token> npm publish --access public
   ```
3. 或者把所有版本号回退一个 patch，重新跑 publish

### Q: 想跳过测试守门

不建议，但临时可这样改 `.github/workflows/publish-npm.yml`：

```yaml
- run: pnpm test || echo "tests skipped"
```

或者注释掉 test step，merge 后再恢复。

---

## 工具选型说明

| 工具 | 选用了吗 | 理由 |
|---|---|---|
| **[changeset](https://github.com/changesets/changesets)** | ✅ | monorepo 版本管理事实标准 |
| **[changesets/action](https://github.com/changesets/action)** | ✅ | 与 GitHub Actions 集成最深 |
| **[pnpm publish](https://pnpm.io/cli/publish)** | ✅ | 自动转换 workspace:^ 协议 |
| [semantic-release](https://github.com/semantic-release/semantic-release) | ❌ | 过度黑盒，与 monorepo 配合复杂 |
| [lerna](https://lerna.js.org/) | ❌ | 现代仓库改用 pnpm+changeset |
| [nx release](https://nx.dev/) | ❌ | 主要为 nx 仓库设计 |
| [release-it](https://github.com/release-it/release-it) | ❌ | 单仓库友好，monorepo 不行 |

---

## Checklist 速查

### 首次发版前

- [ ] npm scope 占领（`@bundlekit` 或备选）
- [ ] npm Automation Token 生成
- [ ] GitHub Secrets 配置 `NPM_TOKEN`
- [ ] Workflow permissions 设 read+write + 允许 PR
- [ ] `.changeset/config.json` baseBranch 正确
- [ ] `.github/workflows/publish-npm.yml` 跑通本地 dry run
- [ ] 所有 `@bundlekit/*` 包版本号统一
- [ ] 所有 `@bundlekit/*` 包 `publishConfig.registry` 正确
- [ ] 所有 `@bundlekit/*` 包 `files` 字段不含源码

### 每次发版

- [ ] 写 changeset 描述变更
- [ ] 本地 `pnpm test` + `pnpm test:integration` 通过
- [ ] commit + push 到 master
- [ ] Review "Version Packages" PR
- [ ] Merge PR
- [ ] 等 workflow publish 完成
- [ ] `npm view` 验证新版本可拉

---

## 相关文档

- [贡献指南](./packages/bundlekit-docs/docs/contributing/index.md) — 完整 contributor 流程
- [发版流程文档站](./packages/bundlekit-docs/docs/contributing/release.md) — 同内容的文档站版本
- [Changeset 官方文档](https://github.com/changesets/changesets)
- [pnpm publish](https://pnpm.io/cli/publish)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
