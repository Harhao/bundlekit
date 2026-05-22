## Context

**当前文档结构**

```
packages/bundlekit-docs/docs/
├── index.md                    主页 + 快速开始
├── guide.md                    快速开始
└── guide/
    ├── architecture.md         架构设计
    ├── bundlers.md             打包器适配器
    ├── cli.md                  CLI 命令参考
    ├── config.md               .bundlekitrc.ts 配置参考
    └── plugins.md              插件
```

**安装心智的当前歧义点**

1. `pnpm add -D @bundlekit/service @bundlekit/cli` 这条命令在新项目目录下要先 init package.json；用户读完不知道是在哪儿装。
2. 没有明确说"cli 是项目脚手架，不必在每个项目里装"。
3. `dc add` 与 `dc create` 的关系没有用图清晰呈现。
4. SSR / tools 是 change 2/3 落地后的新概念，老文档完全没提。

**约束**

- 用 dumi 静态生成，不能引入任何 runtime 文档机制
- 中文为主，命令、字段名保持英文
- README 与 docs 主页内容同步（README 是 npm / GitHub 第一印象）

## Goals / Non-Goals

**Goals**

- 一句话回答"我要怎么开始用 bundlekit" — 推荐 `npx @bundlekit/cli create my-app`
- 提供完整的"两条路径"说明：scaffold-first 与 manual-integration
- 把 changes 1-4 的新行为完整落到文档（runtime prompt、tools、ssr、ink fallback）
- 文档与代码间的"事实声明"一致，不留矛盾

**Non-Goals**

- 不重构 dumi 主题
- 不引入多语言（i18n）
- 不写 API 自动生成（仍人工维护）
- 不引入 changelog 系统（沿用现有 changeset）

## Decisions

### D1：onboarding 入口定位

**主推 scaffold-first，副推 manual-integration**

```
┌─────────────────────────────────────────────────────────────┐
│  📖 docs/index.md                                            │
│   ├─ Hero: 一句话价值主张                                     │
│   ├─ Quick Start (推荐):                                     │
│   │     npx @bundlekit/cli create my-app                        │
│   ├─ 适合场景对照表：                                          │
│   │     • 新项目 → scaffold                                  │
│   │     • 已有项目 → manual-integration                      │
│   └─ 链接到 guide.md                                         │
└─────────────────────────────────────────────────────────────┘
```

### D2：guide.md 重写结构

```
# 快速开始

## 你需要什么
- Node >= 18
- pnpm 8+ (推荐) / npm / yarn

## 方式一：脚手架创建（推荐）
1. npx @bundlekit/cli create my-app
2. cd my-app && pnpm dev
   → 会被 prompt 选择 template / bundler
   → cli 自动写入 service + plugin + bundler 到 devDeps

## 方式二：现有项目接入
1. pnpm add -D @bundlekit/service @bundlekit/plugin-react
2. dc add bundler-vite
3. 创建 .bundlekitrc.ts
4. package.json scripts 加 "dev": "ds serve --bundler vite"

## 全局安装 cli（可选）
pnpm add -g @bundlekit/cli
dc create my-app

## 项目结构
（基于 scaffold 出来的标准结构）

## 下一步
- [配置参考](/guide/config)
- [CLI 命令](/guide/cli)
- [SSR 指南](/guide/ssr)
```

### D3：每个 change 在文档中的归宿

| Change | 文档归宿 |
|---|---|
| 1 (refactor-bundler-deps) | `cli.md` 加 add bundler-* 表；`bundlers.md` 加"安装方式"；`guide.md` 强调 cli 自动装；提示 runtime prompt 行为 |
| 2 (add-config-escape-hatch) | `config.md` 加"逃生舱（tools）"章节，5 个 bundler × 1 用例 |
| 3 (add-ssr-support) | 新增 `ssr.md`；`bundlers.md` 加 SSR 矩阵；`config.md` 加 ssr 字段 |
| 4 (improve-cli-ux) | `cli.md` 加截图、Windows 终端建议、`DEVKIT_NO_INK` 说明 |

### D4：截图 / 演示形式

- ASCII art 框图（保留 markdown 友好）
- 对于 ink UI：用 asciinema 录制后转为 SVG（`svg-term-cli`），放在 `docs/assets/`
- 不依赖外部图床

### D5：文档与代码同步机制

- 在每个 change 的 tasks.md 中已经包含"对应文档章节"的 task，本 change 收口
- 在 release 流程的 changeset 中要求"对应代码 change 都已合入"才发版
- 不引入文档自动化校验工具（成本不划算）

### D6：版本表述

文档中所有 `0.0.x` 版本号引用，迁移到使用 `:::tip`（dumi 支持）显示当前版本：

```
:::info 当前版本
@bundlekit/cli@0.x.y · @bundlekit/service@0.x.y · @bundlekit/bundler-*@0.x.y
:::
```

但版本数值保持手工同步（不引入构建时注入），与现有方式一致。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 文档与代码 release 节奏脱节 | 每个 PR 在合入前 reviewer 确认 docs 同步；本 change 提供基线 |
| 用户老书签 404 | 保留 `architecture.md` 等大节 anchor；删除小节时加 deprecation note |
| Windows 终端兼容提醒位置不明显 | 放在 `cli.md` 顶部 admonition 框 |
| 截图脚本依赖 asciinema 等外部工具，未来维护成本 | 第一版截图后 6 个月内基本不变；维护成本可接受 |
| 多 change 的协同信息分散在多文件，用户难找全 | `index.md` 提供"按主题导航"表格 |

## Migration Plan

1. 等 change 1 / 4 落地一部分（runtime prompt + ink）后，先更新 `cli.md` / `bundlers.md` / `guide.md`
2. 等 change 2 落地后，更新 `config.md` 的 tools 章节
3. 等 change 3 落地后，新增 `ssr.md`
4. 最后整体 review 一致性，发新版本

## Open Questions

- 是否要在 docs 中加"已知问题（known issues）"页？建议**做**，作为兜底，每次发版同步
- 是否需要给文档加搜索能力？dumi 默认提供，本 change 不引入额外工作
- 中英双语？暂不做，未来如有海外用户再考虑
