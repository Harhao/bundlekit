## Context

`@bundlekit/cli` 的 create 流程在最近 4 个 active change（refactor-bundler-deps / improve-cli-ux / polish-create-ux / adopt-workspace-protocol-templates）打磨后已经基本稳定，但本地真实运行 `pnpm debug` 时仍能撞到一组"看似 hang 实则在等输入"的 UX 缺陷。诊断追踪：

```
用户视角                            实际发生
─────────                          ─────────────────────────
1. spinner: "正在安装依赖..."        pnpm install 在跑（< 5s）
2. stderr 喷一行 ERR_INVALID_PROTOCOL  setBinaryMirrors 探测 cypress mirror 失败
3. logger: "DONE 项目 创建成功"       install 已完成
4. spinner 收尾，没换行              spinner.stopSpinner 之后没 println
5. plugin-react/generator 弹 enquirer  "是否同时安装 @bundlekit/request..."
6. 用户看不到 prompt 文案             被前面噪音淹没
7. 等待键盘输入                       用户以为还在 install，开始焦虑
8. 5 分钟后 ctrl+c                    test-app 半成品留在磁盘
```

约束：
- 不能直接删 generator 的 prompt（plugin-react / plugin-vue 的扩展点保留意义）
- 但要在 ink TTY / CI / 非 TTY 路径默认 silent，避免抢 stdin
- monorepo 内 dev 是常用路径，PackageManager 必须正确处理（不能依赖 link 协议侥幸绕开）
- 不破坏已归档 spec（cli-create / bundler-installation 已被多次 modified，本次再加 modify 子句）
- 不引入新依赖（lockstep 假设要求 @bundlekit/request 用 workspace:^）

## Goals / Non-Goals

**Goals:**
- `pnpm debug` 在 monorepo 内秒级跑完，不需要任何用户交互（ink 默认值）
- generator prompt 仅在显式 TTY 模式（非 ink、用户主动调 add）时弹出
- prompt 弹时文案清晰（前置换行 + 颜色），不会被 spinner / 日志遮蔽
- generator 写的依赖版本号永远是 `workspace:^`，由 cli 兜底转 link / ^cliVersion
- monorepo 子目录创建项目时 `pnpm install` 自动加 `--ignore-workspace`
- `setBinaryMirrors` 错误彻底 silent，不污染 stderr
- 新增集成测试覆盖 prompt-silent 与版本无残留两个不变量

**Non-Goals:**
- 不重构整个 generator 接口（保持现有 `IGeneratorAPI`）
- 不删除 `@bundlekit/request` 这个可选包（保留 plugin-react 的"问要不要装 request"语义，仅改触发条件）
- 不实现"prompt 升级为 cli step"（让 dc create 命令在 ink 流程内问 request 选项）— 这是更大改动，留给后续
- 不动 add-config-escape-hatch / add-ssr-support 已落地的 spec
- 不改 changeset config / GitHub Actions（与发版流程无关）

## Decisions

### D1：generator prompt 触发条件

```ts
// 新策略
const shouldSkipPrompt =
    !process.stdout.isTTY ||
    process.env.DEVKIT_NO_PROMPT === "1" ||
    process.env.CI === "true" ||
    process.env.CI === "1";

if (shouldSkipPrompt) {
    // 默认值：installRequest = false（保守不加依赖）
    return;
}
// 真 TTY + 非 CI 才弹
```

为什么不是更激进的"全部不弹"：
- 用户用 `dc add react`（非 create 路径）时，generator 仍可被独立调用，应该弹 prompt 让用户选
- 仅在 cli create 路径下应该静默（因为 create 已经是个完整流程，不该再插问）

ink 路径下注入 `DEVKIT_NO_PROMPT=1` 是因为 ink 控制 stdout/stdin，再让 enquirer 抢会撕裂渲染。

### D2：generator 依赖版本用 workspace:^

```diff
- api.addDependency("@bundlekit/request", "^1.0.0");
+ api.addDependency("@bundlekit/request", "workspace:^");
```

后续由 cli 的 `normalizeDeps` 兜底转换：
- monorepo 内 → `link:/abs/path/to/packages/bundlekit-request`
- monorepo 外 → `^${cliVersion}`

但 `addDependency` 是 generator 调用的，写完之后还会跑一次 `installDeps`（如果 hasPendingDeps）。需要在 generator 写完之后**再调一次 normalizeDeps**，否则 `workspace:^` 会被 `pnpm install` 直接拒绝（项目不在 workspace 中）。

```
                    create 流程的 normalize 时机
                              │
                              ▼
   1. renderTemplates                       (写 workspace:^ 到 package.json)
   2. normalizeDeps    ← 已存在            (替换为 link / ^cliVersion)
   3. injectBundlerToDeps                   (写选中的 bundler，按 depMode 写值)
   4. installDeps                           (pnpm install 跑通)
   5. runGenerator
       └─ generator.addDependency
           写 "@bundlekit/request": "workspace:^"
   6. normalizeDeps    ← 新增！            (再替换一次)
   7. installDeps（如果 hasPendingDeps）   (装 generator 追加的依赖)
```

### D3：PackageManager 自动加 --ignore-workspace

```ts
// install / runCommand 内：
private shouldIgnoreWorkspace(): boolean {
    if (this.bin !== EPackageMangerTool.PNPM) return false;
    // cwd 在某个 pnpm-workspace.yaml 之下但 cwd 自身不是 workspace member
    const ws = findEnclosingPnpmWorkspace(this.context);
    if (!ws) return false;  // 没 workspace，不需要
    const isMember = isWorkspaceMember(ws.root, this.context, ws.workspacePackages);
    return !isMember;  // 非成员 → 必须 --ignore-workspace
}
```

`findEnclosingPnpmWorkspace` / `isWorkspaceMember` 实现简单：
- 向上找 `pnpm-workspace.yaml`
- 解析 `packages: [...]` 字段（用 `js-yaml` 或简单正则）
- 检查 `path.relative(ws.root, this.context)` 是否匹配某个 glob

为什么不是无脑全部加 `--ignore-workspace`：
- 真 workspace 成员（如 `packages/bundlekit-cli/` 自己）需要 workspace 协议解析
- 自动检测能在两种场景下都对

### D4：setBinaryMirrors 错误静默

```diff
  async setBinaryMirrors() {
      const registry = await this.getRegistry()
      if (registry !== registries.taobao) return
      try {
          const meta = await this.getMetadata('binary-mirror-config', { full: true })
          // ... 设置 ENV ...
      } catch (e) {
-         console.error(e);
+         // silent: binary-mirror 探测失败不影响主流程
+         this.logger.debug?.(`binary-mirror 探测失败（已忽略）: ${e?.message}`);
      }
  }
```

`logger.debug` 是新加的（如果 Logger 没有 debug 方法就用 noop）。同时给 `getMetadata` 加 5 秒超时。

### D5：prompt 视觉分隔

generator 在 prompt 之前：

```ts
console.log("\n");  // 强制换行，跳过 spinner 残留
console.log("\x1b[36m──── 框架插件配置 ────\x1b[0m");  // cyan 分隔符
const { installRequest } = await api.prompt(...);
```

只有真 TTY + 非 CI 时才走到这段，所以加颜色 ANSI 是安全的。

### D6：单测覆盖

新增 `__tests__/integration/cli/cli-create-prompts.test.ts`：

```ts
describe("cli-create generator prompt silenced", () => {
    it("DEVKIT_NO_PROMPT=1 skips request prompt", async () => {
        const { cwd, cleanup } = await makeTmpCwd("prompt-silent");
        const r = runCreate({
            cwd,
            name: "demo",
            template: "react-ts",
            bundler: "vite",
            env: { DEVKIT_NO_PROMPT: "1", DEVKIT_DEP_MODE: "npm" },
        });
        expect(r.code).toBe(0);
        const pkg = readPkg(cwd, "demo");
        expect(pkg.dependencies?.["@bundlekit/request"]).toBeUndefined();
        expect(JSON.stringify(pkg)).not.toContain("^1.0.0");
        await cleanup();
    });
});
```

加到现有 cli-create.test.ts 文件作为新 describe block。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 用户在真 TTY 下确实想装 @bundlekit/request 但 prompt 被静默 | 仅在 `DEVKIT_NO_PROMPT=1` / CI / 非 TTY 时静默；`pnpm dc create my-app` 在终端跑会弹 prompt |
| `--ignore-workspace` 检测误判（其他 monorepo 含 `pnpm-workspace.yaml`） | 双重判定：cwd 在 workspace 树下 + 不是 workspace member 才加 |
| addDependency("workspace:^") 在 generator-only 场景（非 cli create 路径）下 normalize 不会再调 | 如果用户在已有项目目录手工 `dc add react` 触发 generator，会留下 `workspace:^`；但本 change 同时让 `dc add` 命令在调用 generator 后也跑 normalizeDeps |
| Logger 没有 debug 方法导致运行时 undefined | 用可选链 `logger.debug?.(...)` + Logger 类同步加一个 noop debug 方法 |
| binary-mirror-config 真的有用的小概率（仅 cypress 用户在国内） | 它原本就是探测 + 失败兜底，silent 不影响主流程；用户需要时可手工配 CYPRESS_INSTALL_BINARY |

## Migration Plan

### Phase 1：generator silenced

1. `plugin-react/generator/index.ts` 加 `shouldSkipPrompt` 判定
2. `plugin-vue/generator/` 同款（如存在）
3. 把 `^1.0.0` 改成 `workspace:^`

### Phase 2：cli 注入 DEVKIT_NO_PROMPT

4. `CreateApp.tsx` 在调 `runGenerator` 之前 `process.env.DEVKIT_NO_PROMPT = "1"`
5. `creator.ts`（legacy 路径）同款
6. `dc add` 命令路径**不**注入（保留交互式 add 的 prompt 能力）

### Phase 3：normalizeDeps 二次调用

7. `actions.ts` / `creator.ts` 在 `runGenerator` 之后再调一次 `normalizeDeps`
8. CreateApp.tsx 加 task `normalize-after-generator`

### Phase 4：PackageManager 改造

9. `pkgManager.ts` 加 `findEnclosingPnpmWorkspace` / `isWorkspaceMember` helpers
10. `runCommand` 在 pnpm + 非成员场景追加 `--ignore-workspace`
11. `setBinaryMirrors` 错误 silent + 超时

### Phase 5：测试

12. 单测：pkgManager workspace 检测 helpers
13. 集成测试：cli-create-prompts.test.ts
14. 现有 cli-create.test.ts 加 "no `^1.0.0` literal" 断言

### Phase 6：changeset + 验证

15. `.changeset/fix-create-flow-prompts.md`
16. 真终端跑 `pnpm debug` 完整跑通无 prompt
17. 三档测试全过

回滚：每个 phase 独立可 revert；本 change 不引入运行时副作用，回滚成本低。

## Open Questions

- **`dc add` 命令是否也要改 prompt 静默？** 目前不改（保留交互能力），但要在 docs 里强调"`dc add` 是交互式，cli create 是非交互式"
- **如果用户已经有 `@bundlekit/request@^1.0.0` 在 package.json，本次升级会被覆盖吗？** generator 的 `addDependency` 是直接写 entries，会覆盖；但用户主动 install 过的依赖应该不会被 generator 触发到（generator 只在 cli create / dc add 路径里跑）
- **PackageManager 的 workspace 检测是否需要缓存？** 一次 cli 命令只会调一次，不需要
- **是否要加 GH Actions check 验证 cli 创建流程在 CI 默认能跑通？** 集成测试已经覆盖；CI workflow 跑 `pnpm test:integration` 时会自动验证
