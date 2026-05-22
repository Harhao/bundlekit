## Context

**当前实现**

- `@bundlekit/service/package.json` 在 `dependencies` 里硬绑：
  - `@bundlekit/bundler-webpack` / `bundler-vite` / `bundler-rollup` / `bundler-rspack` / `bundler-rolldown`
- `Service.startBuilder()` (`packages/bundlekit-service/lib/Service.ts:238-275`) 在 `loadBundlerPlugin` 失败时调用 `packageManager.add(packageName, { noSave: true })`，安装到 `node_modules` 但**不写**进项目 `package.json`。
- `@bundlekit/cli/lib/commands/create/creator.ts:48` 仅做 `pm.add("", { noSave: true })`（即 `pnpm install`），不会因 `-b` 选项写入对应 bundler。
- 模板 `package.json.ejs` 的 `devDependencies` 中只列了 `@bundlekit/service` 与 `@bundlekit/plugin-react`，没有 bundler-*。

**业界对照**

- Vite/Rsbuild：核心包不依赖具体 bundler，由用户工程显式装；
- Vue CLI 的 `@vue/cli-service`：把构建器作为 plugin，create 时按需写入 devDeps。

**约束**

- pnpm workspace monorepo：开发态 service 通过 `workspace:*` 链接，移除 `dependencies` 后开发链路不能断。
- `engines.node >= 18`，可使用 `prompts`/`enquirer` 现代交互能力。
- CI 等非 TTY 场景必须能不阻塞地报错。

## Goals / Non-Goals

**Goals**
- service 安装体积下降（移除 4 个无关 bundler 的 native 依赖树）。
- 任何"找不到 bundler 适配器"的场景都被显式处理：要么用户同意安装写入 devDeps，要么报错引导，**不再静默临时安装**。
- cli 的 `create -b X` 与 `add bundler-X` 是用户管理 bundler 依赖的唯一两条入口。
- 开发态（monorepo workspace）零回归 — service 仍能解析到本地 bundler 包。

**Non-Goals**
- 不在本 change 内改 `IBuildConfig` schema（`tools` 字段是 change 2 的工作）。
- 不引入版本范围管理 / lockfile 维护 — 沿用 pnpm 默认行为。
- 不实现 cli 的 ink 化（change 4 处理）。

## Decisions

### D1：service 是 `peerDependenciesMeta.optional` 还是直接移除？

**选 `peerDependenciesMeta.optional` + 完全去 deps**

| 方案 | 优点 | 缺点 |
|---|---|---|
| 仅移除 `dependencies` | 简单 | npm/pnpm 不会给类型检查/编辑器提示 bundler 包的版本范围 |
| **移除 deps + 加 `peerDependenciesMeta`** ✅ | npm 8+ 不强制安装 optional peer，pnpm 友好；package manager 提供清晰提示 | 需要维护版本范围 |
| 改成 `optionalDependencies` | npm 装时仍下载 | 不达到瘦身目标 |

`peerDependenciesMeta` 写法：
```jsonc
{
  "peerDependencies": {
    "@bundlekit/bundler-webpack": "workspace:*",
    "@bundlekit/bundler-vite":    "workspace:*",
    "@bundlekit/bundler-rspack":  "workspace:*",
    "@bundlekit/bundler-rollup":  "workspace:*",
    "@bundlekit/bundler-rolldown":"workspace:*"
  },
  "peerDependenciesMeta": {
    "@bundlekit/bundler-webpack": { "optional": true },
    "@bundlekit/bundler-vite":    { "optional": true },
    "@bundlekit/bundler-rspack":  { "optional": true },
    "@bundlekit/bundler-rollup":  { "optional": true },
    "@bundlekit/bundler-rolldown":{ "optional": true }
  }
}
```

发布到 npm 后，`workspace:*` 会被替换成具体版本（`pnpm publish` 自动转换）。

### D2：缺失 bundler 时的交互流

**采用 yes/no confirm，并提供 CI 旁路**

```
┌──────────────────────────────────────────────────────────────────┐
│  Service.startBuilder()                                          │
│   1. require.resolve(bundlerPkg) → 找到? ─ yes ─► 加载 + 跑      │
│                                              │                   │
│                                              ▼ no                │
│   2. process.stdout.isTTY && !DEVKIT_NO_PROMPT?                  │
│        ├─ yes → confirm("未安装 X, 现在安装? (Y/n)")              │
│        │         user yes → pm.add(X, { dev: true }) ─► retry    │
│        │         user no  → exit(1) 输出引导                      │
│        └─ no  → DEVKIT_AUTO_INSTALL=1?                            │
│                  yes → 直接 pm.add(X, { dev: true })              │
│                  no  → exit(1) 输出引导                           │
└──────────────────────────────────────────────────────────────────┘
```

| 旋钮 | 含义 |
|---|---|
| `process.stdout.isTTY` | 判定是否交互环境 |
| `DEVKIT_NO_PROMPT=1` | 强制非交互（即使 TTY） |
| `DEVKIT_AUTO_INSTALL=1` | 非交互环境下自动安装（CI 友好） |

### D3：`PackageManager.add` 是否需要新增能力？

不新增。现有签名 `pm.add(pkgName, { dev?: boolean; noSave?: boolean })` 已足够，只需把调用点 `noSave: true` 改成 `dev: true`。

### D4：CLI `create` 写入版本号怎么决定？

**采用 cli 自身版本号 + caret 前缀（lockstep 假设）**

```ts
const version = `^${cliPkg.version}`;   // e.g. "^0.0.1"
projectPkg.devDependencies[bundlerPkgName] = version;
```

理由：
- 整个 monorepo 用 changeset 锁版（fixed versioning），cli / bundler 同步发版
- 把 bundler-* 加入 cli 的 `dependencies` 来"取版本"会反作用 — 用户 `npm i @bundlekit/cli` 时会拖进 5 个 bundler，恰恰是要避免的
- 当 lockstep 失效（极少数场景），用户可以手工 `pnpm add -D @bundlekit/bundler-X@<version>` 覆盖

替代方案：硬编码版本表 — 否决（发版漂移）。
替代方案：把 bundler-* 加入 cli devDependencies — 否决（user install 仍会拉）。

### D5：`add bundler-X` 的命名约定

复用现有 `PLUGIN_MAP` 映射风格。新增映射：

```ts
const BUNDLER_MAP: Record<string, string> = {
  webpack:  "@bundlekit/bundler-webpack",
  vite:     "@bundlekit/bundler-vite",
  rspack:   "@bundlekit/bundler-rspack",
  rollup:   "@bundlekit/bundler-rollup",
  rolldown: "@bundlekit/bundler-rolldown",
};
```

输入约定：`dc add bundler-vite` → `@bundlekit/bundler-vite`；裸 `dc add vite` 仍解析为 vite bundler（前缀 `bundler-` 可省略，但需在 `add` 命令内消歧 — 通过判断字符串是否在 `BUNDLER_MAP` 即可）。

### D6：Service 中加载 bundler 适配器的版本一致性

不做硬校验。第一版只保证"能 resolve 即用"，跨版本兼容由 bundler 适配器自身的 IBuildToolAdapter 接口稳定性保证。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| 老项目升级后第一次启动会被 prompt 安装 bundler-*，体感惊讶 | release notes 标注 BREAKING；docs 增加迁移指南；提示文本中明确"这是一次性安装" |
| `peerDependenciesMeta.optional` 在不同包管理器表现略异（npm/pnpm/yarn） | 限定 README 推荐 pnpm；npm 用户在文档中给出手工 install 指引 |
| CI 没设 `DEVKIT_AUTO_INSTALL` 会直接 exit(1) | 文档中明确 CI 配置示例 |
| dev workspace 链接断裂（service 不再 deps bundler-*，turbo task graph 可能不再传递依赖） | `turbo.json` 中 `service:build` 任务显式 `dependsOn` 各 bundler 的 build；workspace 中 service 仍可 require.resolve，因为它们都是 sibling package |
| 多 bundler 用户每个都要被 prompt 一次，繁琐 | 不缓解（用户主动行为）；提供 docs 例子让用户一次性 `pnpm add -D @bundlekit/bundler-{vite,webpack}` |

## Migration Plan

1. **预备阶段（不破坏）**
   - 在 cli 与 shared-utils 中先实现 confirm 工具与 `add bundler-*` 路径。
   - 文档中加 "Bundler 安装变更" 预告。

2. **Breaking 切换**
   - 一次性 PR：移除 service 的 5 个 deps、改 startBuilder 行为、cli create 写入 devDeps、更新所有模板默认。
   - 版本号 bump 到 `0.1.0`（minor，但因 BREAKING 也可考虑 major，由发版人决定）。

3. **回滚预案**
   - 保留 `Service.startBuilder` 旧路径在 git 历史；如出问题，恢复 deps 与 `noSave: true` 即可，不影响数据/磁盘状态。

## Open Questions

- 是否需要给 `add bundler-*` 后**自动更新 `.bundlekitrc.ts` 的 `bundler` 字段**？倾向不自动改（用户切 bundler 是显式动作，让 cli 再问一次更友好）。
- prompt 文案中文 / 英文：与现有 cli 一致（中文）。
- 是否对 npm registry 之外的私有 registry（公司内网）做特殊处理？暂不做。
