---
title: 运行测试
order: 3
---

# 运行测试

bundle-bundlekit 用三档测试覆盖不同抽象层：

```
单元测试 (unit)        毫秒级      纯函数 / 类型 / 配置解析
集成测试 (integration) 20 秒级      cli 创建 / bundler build / dev SSR HTTP
端到端 (e2e)          1 分钟级     Playwright + 真实浏览器 HMR
```

## Unit Tests

```bash
pnpm test
```

位置：`__tests__/*.test.ts`

覆盖：
- `confirm.test.ts` — yes/no prompt + TTY 检测
- `applyTools.test.ts` — tools hook 调用顺序
- `tools-types.test.ts` — `IBundlerConfigMap` 类型推断
- `validate.test.ts` — `IBuildConfig` schema 校验（含 SSR 互斥）
- `configLoader.test.ts` — `.bundlekitrc.ts` 加载与默认值合并
- `service.test.ts` — `getBundlerRegistry` 类型 + 插件 apply 顺序
- `depMode.test.ts` — `findMonorepoRoot` / `resolveDepMode` / `normalizeDeps`

新增 unit 时：
1. 加 `__tests__/<feature>.test.ts`
2. 用 `describe(...)` + `it(...)` + `expect(...)`
3. 跑 `pnpm test -- <feature>` 单跑

## Integration Tests

```bash
# 全跑
pnpm test:integration

# 单测一个 bundler 的 build
pnpm test:integration -- vite-spa
```

位置：`__tests__/integration/`

```
__tests__/integration/
├── helpers/                # 复用工具
│   ├── port.ts             # 动态端口
│   ├── fixture.ts          # copyFixture(bundler, mode)
│   ├── spawnService.ts     # spawn bundlekit-service 子进程
│   ├── fetch.ts            # node fetch helper
│   ├── runBuild.ts         # build helper
│   ├── buildAssertions.ts  # assertSpaBuild / assertLibraryBuild / assertSsrBuild
│   ├── devSSR.ts           # startDevSSR + assertDevSSR
│   └── hmr.ts              # assertClientHMR (Playwright)
├── fixtures/               # 测试用 fixture
│   ├── shared/             # 5 个 bundler 共用源码
│   └── <bundler>/          # 各 bundler 自己的 .bundlekitrc + package.json
├── build/                  # 15 个 build 测试（5 bundler × 3 mode）
├── dev-ssr/                # 5 个 dev SSR HTTP curl 测试
├── cli/                    # cli 创建项目集成测试
├── e2e/                    # Playwright HMR 测试
└── .tmp/                   # 测试运行临时目录（gitignored）
```

### 测试矩阵

|             | SPA build | Library build | SSR build | dev SSR HTTP | HMR (Playwright) |
|-------------|:---------:|:-------------:|:---------:|:------------:|:----------------:|
| webpack     | ✓         | ✓             | ✓         | ✓            | skip*            |
| vite        | ✓         | ✓             | ✓         | ✓            | ✓                |
| rspack      | ✓         | ✓             | ✓         | ✓            | skip*            |
| rollup      | ✓         | ✓             | ✓         | ✓            | n/a              |
| rolldown    | ✓         | ✓             | ✓         | ✓            | n/a              |

\* webpack/rspack HMR 在 SSR middleware 路径下需要 React Fast Refresh 集成；dev SSR HTTP 已自动化覆盖。

### 添加新的 build 测试

```bash
# 1. 在 fixtures/<bundler>/ 已有 .bundlekitrc.<mode>.ts
# 2. 新增 build/<bundler>-<mode>.test.ts
```

```ts
import { describe, it } from "vitest";
import { assertSpaBuild } from "../helpers/buildAssertions";

describe("<bundler> spa build", () => {
    it("produces expected spa artifacts and content", async () => {
        await assertSpaBuild("<bundler>");
    });
});
```

### 添加新的 dev SSR 测试

```ts
import { describe, it } from "vitest";
import { assertDevSSR } from "../helpers/devSSR";

describe("<bundler> dev SSR HTTP", () => {
    it("GET / returns 200 with SSR_MARKER", async () => {
        await assertDevSSR("<bundler>");
    }, 90_000);
});
```

## E2E (Playwright)

```bash
# 一次性安装浏览器（约 90MB 下载，国内首次较慢）
pnpm playwright install chromium

# 跑测试
pnpm test:e2e
```

位置：`__tests__/integration/e2e/*.spec.ts`

每个 spec：
1. 起 dev SSR server
2. Playwright 打开页面
3. 编辑 fixture 源文件
4. 等 HMR 应用
5. 断言新内容显示

```ts
import { test } from "@playwright/test";
import { assertClientHMR } from "../helpers/hmr";

test("vite client HMR updates without page reload", async ({ page }) => {
    await assertClientHMR("vite", page);
});
```

测试 try-finally 自动还原 fixture 文件，避免脏 state。

## 全跑

```bash
pnpm test:all
# 等价于 pnpm test && pnpm test:integration && pnpm test:e2e
```

CI 默认跑 `test` + `test:integration`；`test:e2e` 仅在显式触发时跑（避免每次 PR 等 1 分钟下载浏览器）。

## 调试技巧

### 单测调试

```bash
# 仅跑某文件
pnpm test -- depMode

# 仅跑某 it
pnpm test -- depMode -t "auto-detects monorepo"

# 显示 console.log
pnpm test -- --reporter=verbose
```

### 集成测试调试

测试失败时 fixture 会保留在 `__tests__/integration/.tmp/`：

```bash
# 失败用例
pnpm test:integration -- webpack-ssr

# 进 .tmp 看产物
ls __tests__/integration/.tmp/webpack-ssr-*/dist/
```

### Playwright 调试

```bash
# 头模式（看到浏览器）
pnpm playwright test --headed

# trace 模式（失败时录制 trace.zip）
pnpm playwright test --trace on
pnpm playwright show-trace test-results/.../trace.zip
```

## CI 集成

`.github/workflows/publish-npm.yml` 在 publish 前会跑：

```yaml
- run: pnpm test
- run: pnpm test:integration
```

任何失败 block publish。

`pnpm test:e2e` 因为依赖 chromium 下载，目前**不**在 PR check 中跑。如需启用：

```yaml
- run: pnpm playwright install chromium
- run: pnpm test:e2e
```
