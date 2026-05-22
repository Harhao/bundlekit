---
title: 贡献指南
order: 1
nav:
  title: 贡献
  order: 5
---

# 贡献指南

欢迎参与 bundle-bundlekit！本目录沉淀所有给开发者/贡献者的工程化文档。

## 章节速览

- **[环境搭建](./setup)**：clone 仓库 → install → build → dev 工作流
- **[运行测试](./testing)**：unit / integration / e2e 三档测试
- **[新增 bundler](./adding-bundler)**：`IBuildToolAdapter` 接口与注册流程
- **[新增 plugin](./adding-plugin)**：`PluginAPI` 与 framework 字段约定
- **[发版流程](./release)**：changeset workflow + GitHub Actions 自动 publish

## 贡献生命周期

```
fork           → 你的 GitHub 账号下复刻仓库
branch         → 从 master 切出 feature/<name> 分支
develop        → 改代码 + 写测试
test           → pnpm test && pnpm test:integration 全过
changeset      → pnpm changeset 描述本次变更
PR             → 提 PR 到 upstream/master
review         → 维护者 review + 协作打磨
merge          → master 自动触发 GitHub Actions
release        → changesets/action 创建 Version Packages PR；merge 后自动 npm publish
```

## 行为准则

- **保持 OpenSpec 流程**：任何 spec-level 变更（新增 capability / 修改 requirement）都通过 `openspec/changes/<name>/` 走完 propose → apply → archive 流程
- **变更前看 spec**：修代码前先看 `openspec/specs/<capability>/spec.md` 当前需求
- **测试先行**：unit 覆盖纯函数，integration 覆盖 cli/runtime 集成路径，e2e 覆盖浏览器交互
- **changeset 必写**：所有面向用户可见的代码变更都要写 changeset

## 反馈渠道

- Issue 报错 / 提需求：[GitHub Issues](https://github.com/Harhao/bundle-bundlekit/issues)
- 设计探讨 / 请求 review：PR 评论
- 紧急安全：私聊维护者邮箱

## 你的第一个 PR

第一次贡献推荐挑选 `good first issue` 标签的任务。流程：

```bash
# 1. fork & clone
git clone https://github.com/<YOUR_USER>/bundle-bundlekit.git
cd bundle-bundlekit

# 2. 装依赖 + 起 dev 环境
pnpm install
pnpm build:all

# 3. 切分支 + 改代码
git checkout -b feature/my-fix

# 4. 跑测试
pnpm test
pnpm test:integration

# 5. 写 changeset（最关键）
pnpm changeset
# 按交互提示选受影响的包 + 选 patch/minor/major + 写说明

# 6. commit + push
git add .
git commit -m "feat: my fix"
git push origin feature/my-fix

# 7. 在 GitHub 提 PR 到 upstream/master
```
