## Context

仓库当前测试现状：
- 38 个 unit 测试均位于根目录 `__tests__/`，覆盖 confirm / applyTools / tools-types / validate / configLoader / service
- 全部用 vitest 跑，无 fixture，无子进程
- 没有任何针对 bundler adapter 真实编译产物的自动化验证

`add-ssr-support` change 完成后会引入 4 个新的 `createSSRMiddleware` 实现。这些 dev SSR HTTP 路径包含：
- 子进程级的 watcher 生命周期
- require cache 失效的 race condition
- 中间件链顺序（dev-middleware → hot-middleware → ssrHandler）
- HMR 客户端注入

这些都不是单元测试能覆盖的，必须用真实 HTTP 行为做端到端验证。

约束：
- 不能引入对具体业务的硬依赖（fixtures 必须是最小可复现集）
- 必须能在 CI 上无人值守跑（无 TTY，无 watch 长进程）
- 必须并行安全（每个测试用 random port，避免 9000/3000 冲突）
- Playwright 浏览器下载在 CI 慢，需缓存策略

## Goals / Non-Goals

**Goals:**
- 建立 fixture 目录约定，让后续新加 bundler / 新加测试用例零摩擦
- 5 bundler × {SPA build, Library build, SSR build} 共 15 个 build-type 用例自动化
- vite/webpack/rspack × {dev SSR HTTP curl, HMR Playwright} 共 6 个 dev-type 用例自动化
- rollup/rolldown × {dev SSR HTTP curl}（无 HMR）共 2 个 dev-type 用例自动化
- 测试运行时间预算：unit < 5s，integration < 3min，e2e (HMR) < 1min
- 失败信息可读：能直接告诉开发者"vite SSR build 缺少 dist/server/server.cjs"

**Non-Goals:**
- 不验证产物字节级别的稳定性（不做 snapshot 测试）
- 不覆盖 plugin-mock / plugin-react / plugin-vue 的功能（这些应该有自己的 unit）
- 不做性能基准测试（build time / bundle size 不在范围）
- 不支持 Windows CI（fixture 路径处理 unix-style 即可）
- 不打 watch 时长测（每个测试有 30s timeout 上限）
- 不验证多页面 / 多入口高级特性（与 SSR 互斥已有 unit 覆盖）

## Decisions

### D1: fixtures 目录结构 — 共享源码 + 每 bundler 独立配置

**采用方案**：

```
__tests__/integration/fixtures/
├── shared/
│   ├── src/
│   │   ├── App.tsx              # 共用 React 组件
│   │   ├── entry-client.tsx
│   │   ├── entry-server.tsx
│   │   └── index.ts             # Library 模式入口
│   ├── public/
│   │   └── index.html           # 含 <!--ssr-outlet-->
│   ├── tsconfig.json
│   └── package.json             # 共用 deps（react/react-dom）
├── webpack/
│   ├── .bundlekitrc.spa.ts
│   ├── .bundlekitrc.lib.ts
│   ├── .bundlekitrc.ssr.ts
│   └── package.json             # symlink 或 extends shared
├── vite/  ...
├── rspack/ ...
├── rollup/ ...
└── rolldown/ ...
```

**为什么不每 bundler × 模式独立 fixture**：
- 5 × 3 = 15 份重复源码，维护噩梦
- 共享源码 + 不同 .bundlekitrc.ts 是"换一行 import"的最小差异

**为什么不用 monorepo workspace**：
- fixtures 作为黑盒应该模拟外部用户项目，不该共享 lockfile / hoist
- 但运行时通过 `pnpm link` 或 `file:` 协议指向 monorepo 包，避免发版才能测

### D2: vitest 配置分离 — unit 与 integration 解耦

```
vitest.config.ts                # 现有 unit 配置（保持不动）
vitest.integration.config.ts    # 新增 integration 配置
  - testTimeout: 60000
  - hookTimeout: 60000
  - reporters: ['verbose']
  - include: ['__tests__/integration/**/*.test.ts']
  - pool: 'forks'                # 子进程隔离，避免 watcher 泄漏
  - maxConcurrency: 2            # 端口冲突缓解
playwright.config.ts            # e2e HMR 测试单独跑
```

`package.json` scripts:
```jsonc
{
  "test": "vitest run",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:e2e": "playwright test",
  "test:all": "pnpm test && pnpm test:integration && pnpm test:e2e"
}
```

### D3: 每个测试的子进程编排

**采用方案**：用 `child_process.spawn` 起 `bundlekit-service` 子进程，用 `get-port` 拿空闲端口，等待"server ready"日志后发请求。

```ts
// __tests__/integration/helpers/spawnService.ts
async function spawnService({
    fixtureDir: string,
    cwd: string,
    args: string[],         // ['serve', '--bundler', 'vite', '--mode', 'development']
    waitForLog: RegExp,     // /Server running on/
    timeout?: number,
}): Promise<{ port: number; kill(): Promise<void> }>;
```

子进程使用 `DEVKIT_QUIET=1` 关 logger 噪音；测试结束 `process.kill()` + 等 close。

**为什么不用 vite 内 createServer 直接 in-process**：
- 不通用，其他 bundler 不一定有等价 API
- 子进程更接近真实用户场景

### D4: HTTP curl 验证

```ts
// __tests__/integration/helpers/fetch.ts
async function fetchSSR(port: number, path = '/'): Promise<{
    status: number;
    text: string;
    headers: Headers;
}>;
```

使用 node 原生 `fetch`（node ≥ 18，本仓库已有约束）。

断言形态：
- HTML 含 SSR 渲染标记（fixture 内 `<App>` 渲染出固定字符串如 `__SSR_HYDRATE_MARKER__`）
- HTML 含客户端 hydrate script tag
- HTML status 200，content-type text/html

### D5: HMR 验证 — Playwright

```ts
// __tests__/integration/e2e/hmr-vite.spec.ts
test('vite client HMR updates without reload', async ({ page }) => {
    const { port, kill } = await spawnService({ ... });
    await page.goto(`http://localhost:${port}`);
    await expect(page.locator('h1')).toHaveText('original');
    
    // 修改 fixture 源文件
    await editFile('shared/src/App.tsx', /original/, 'updated');
    
    // 等 HMR 应用（不刷新整页）
    await expect(page.locator('h1')).toHaveText('updated', { timeout: 5000 });
    
    // 验证：window.__navigationCount 仍为 1（无 full reload）
    const navCount = await page.evaluate(() => (window as any).__navigationCount);
    expect(navCount).toBe(1);
    
    await kill();
});
```

每次测试结束后**还原 fixture 源文件**（git checkout 或显式写回原内容），避免脏 state。

**为什么不直接 fetch 两次比对内容**：
- HMR 的关键是"不刷新页面就更新"，HTTP 不能验证浏览器层行为
- rollup/rolldown 没 HMR，用单次 fetch 即可（D4 覆盖）

### D6: 端口冲突缓解

- 每个测试用 `getPort()` 拿动态端口
- 测试间通过 `pool: 'forks'` 子进程隔离
- `maxConcurrency: 2`（不并行跑过多 bundler 进程，CI 内存压力可控）

### D7: 测试矩阵实现

```
__tests__/integration/
├── build/
│   ├── webpack-spa.test.ts       # build → 断言 dist/main.js 存在
│   ├── webpack-library.test.ts   # target=node → require dist/index.cjs.export
│   ├── webpack-ssr.test.ts       # 双 pass → require dist/server/server.cjs.render('/')
│   ├── vite-spa.test.ts
│   ├── vite-library.test.ts
│   ├── vite-ssr.test.ts
│   ├── rspack-spa.test.ts
│   ├── rspack-library.test.ts
│   ├── rspack-ssr.test.ts
│   ├── rollup-spa.test.ts
│   ├── rollup-library.test.ts
│   ├── rollup-ssr.test.ts
│   ├── rolldown-spa.test.ts
│   ├── rolldown-library.test.ts
│   └── rolldown-ssr.test.ts
├── dev-ssr/
│   ├── vite-curl.test.ts         # GET /, 200, contains __SSR_MARKER__
│   ├── webpack-curl.test.ts
│   ├── rspack-curl.test.ts
│   ├── rollup-curl.test.ts       # 仅基础渲染
│   └── rolldown-curl.test.ts
├── e2e/
│   ├── hmr-vite.spec.ts          # Playwright
│   ├── hmr-webpack.spec.ts
│   └── hmr-rspack.spec.ts
├── helpers/
│   ├── spawnService.ts
│   ├── fetch.ts
│   ├── fixture.ts                # setup/teardown，复制源码到 tmp，避免 race
│   └── port.ts
└── fixtures/                     # （见 D1）
```

### D8: fixture 安装策略

每个 fixture `package.json` 用 `file:../../packages/bundlekit-service` 等本地路径引用，避免发版才能测。
测试 setUp 时：
1. `cp -r fixtures/<bundler> /tmp/bundlekit-int-<random>` 到隔离目录
2. `pnpm install --no-frozen-lockfile`（首次跑慢，~30s；缓存 node_modules 后续秒级）
3. `npx bundlekit-service ...`

CI 加 `actions/cache` 缓存 `__tests__/integration/.cache/node_modules`。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| Playwright 浏览器下载在 CI 慢（~150MB） | 用 `actions/setup-node` 内置缓存；开发者本地 `playwright install --with-deps chromium` 一次即可 |
| watcher 子进程 kill 不干净导致 next test 端口被占 | helper `kill()` 用 `process.kill('SIGTERM')` 后 `await once(child, 'close')`；fixture teardown 加全局保险 `pkill -f 'bundlekit-service'` |
| HMR 测试 race（编辑文件后 5s 等不到更新视为失败） | 每次测试开端口和子进程都新建，独立 timeout；HMR timeout 5s + 重试 1 次 |
| fixture 源码被测试脏改未还原 | helper `editFile` 用 try-finally 模式，无论成功失败都还原；CI 跑前后各 git diff fixtures 校验干净 |
| 5 bundler × 3 mode = 15 build 测试在 CI 上累计 1~2min | 接受；用 turbo 缓存 + vitest 并发可降到 ~30s |
| rolldown 实验性，build 失败率高 | 单独 `test.skipIf(rolldownBroken)` 标记；CI 出错时 warning 不阻塞 |
| 浏览器 HMR 在 macOS / Linux 行为差异 | 仅 Linux CI 跑 Playwright；Mac 本地手动验证；docs 写明 |
| windows 用户没法跑（路径分隔符 + 端口冲突） | 测试 README 写明仅支持 darwin/linux；本 change 不投入 windows 适配 |
| `add-ssr-support` 还没完，dev SSR 测试启动即失败 | 本 change 任务清单的依赖部分明确"task X 阻塞于 add-ssr-support task Y"；实施时先做 build 测试（不依赖 SSR runtime）解锁 |

## Migration Plan

按"快速反馈 → 复杂集成"递进：

1. **Phase 1：基础设施（无外部依赖）**
   - 建 fixtures 目录树 + shared 源码
   - 写 `vitest.integration.config.ts` + helpers
   - 跑通一个最小 build 测试（vite-spa）证明管道工作

2. **Phase 2：build 矩阵**（不依赖 add-ssr-support）
   - 5 bundler × {SPA, Library} = 10 个测试
   - 跑通后 CI 接入

3. **Phase 3：build SSR 矩阵**
   - 5 bundler × SSR build = 5 个测试
   - 依赖 `add-ssr-support` 的 build 路径（已完成）

4. **Phase 4：dev SSR HTTP 矩阵**
   - 5 bundler × dev SSR curl = 5 个测试
   - 依赖 `add-ssr-support` 的 createSSRMiddleware（实施中）

5. **Phase 5：HMR Playwright**
   - 装 Playwright + chromium
   - vite/webpack/rspack × HMR = 3 个测试
   - 依赖 Phase 4 跑通

6. 回滚：每个 phase 独立可 revert；测试基础设施不改运行时行为，零风险

## Open Questions

- 是否需要在 CI 加专门的 integration job（与 unit 分离），还是 PR check 一次跑完？建议**分离**，integration 仅在 main 分支或显式 label 触发，避免每次 PR 等 3 min。
- Playwright 浏览器是否随 devDependencies 装？建议**不**自动装，开发者本地 `pnpm playwright:install` 手动；CI 用 `actions/setup-node` 缓存。
- fixtures 的 react 版本要不要锁到与 plugin-react 模板一致？建议**锁到一致**，避免 hooks 兼容性问题。
- rolldown SSR 测试在当前阶段（adapter 不稳）是否纳入 CI 必跑？建议**先标 `test.skip`**，等 add-ssr-support 完成后转为必跑。
