# Bundle DevKit Integration Test Suite

集成测试矩阵 — 验证 5 个 bundler × 3 种构建模式 + dev SSR HTTP + HMR。

## 目录结构

```
__tests__/integration/
├── helpers/
│   ├── port.ts            # getFreePort 包装 get-port
│   ├── fixture.ts         # copyFixture(bundler, mode) → 复制源 fixture 到 .tmp/<rand>/
│   ├── spawnService.ts    # spawn `pnpm exec devkit-service ...` 子进程
│   ├── fetch.ts           # fetchSSR + waitUntilHttp
│   ├── runBuild.ts        # build helper（同步 spawnSync）
│   ├── buildAssertions.ts # assertSpaBuild / assertLibraryBuild / assertSsrBuild
│   ├── devSSR.ts          # startDevSSR + assertDevSSR
│   └── hmr.ts             # assertClientHMR (Playwright)
├── fixtures/              # 各 bundler 测试用 fixture（不会污染，测试时复制到 .tmp/）
│   ├── shared/            # 共用源码 + tsconfig + public/index.html
│   │   ├── src/{App.tsx, entry-client.tsx, entry-server.tsx, index.ts}
│   │   ├── public/index.html
│   │   └── tsconfig.json
│   ├── webpack/           # 5 个 bundler 各自一份
│   ├── vite/              #   ├─ package.json (link: 协议引 monorepo 包)
│   ├── rspack/            #   ├─ .devkitrc.spa.ts
│   ├── rollup/            #   ├─ .devkitrc.lib.ts
│   └── rolldown/          #   └─ .devkitrc.ssr.ts
├── build/                 # 15 个 build 测试（5 bundler × 3 mode）
├── dev-ssr/               # 5 个 dev SSR HTTP curl 测试
├── e2e/                   # 3 个 Playwright HMR 测试
└── .tmp/                  # 测试运行时的临时目录（gitignored）
```

## 运行

```bash
# 单元测试（毫秒级）
pnpm test

# 集成测试（5 bundler × build / dev SSR — 约 20s）
pnpm test:integration

# Playwright HMR 测试（约 15-30s，需先装 chromium）
pnpm playwright install chromium
pnpm test:e2e

# 全部
pnpm test:all
```

## 测试矩阵

|             | SPA build | Library build | SSR build | dev SSR HTTP | HMR (Playwright) |
|-------------|:---------:|:-------------:|:---------:|:------------:|:----------------:|
| webpack     | ✅        | ✅            | ✅        | ✅           | skip*            |
| vite        | ✅        | ✅            | ✅        | ✅           | ✅               |
| rspack      | ✅        | ✅            | ✅        | ✅           | skip*            |
| rollup      | ✅        | ✅            | ✅        | ✅           | n/a (无 HMR)     |
| rolldown    | ✅        | ✅            | ✅        | ✅           | n/a (无 HMR)     |

\* webpack/rspack 的 HMR 在 SSR middleware 路径下需要 React Fast Refresh 集成；dev SSR HTTP 已验证可用，HMR e2e 留待后续。

## 添加新测试

1. **新增 bundler**: 在 `fixtures/` 下创建目录 + `package.json` (link: 协议) + 3 份 `.devkitrc.<mode>.ts`
2. **新增 build 用例**: `build/<bundler>-<mode>.test.ts`，调 `assertSpaBuild` / `assertLibraryBuild` / `assertSsrBuild`
3. **新增 dev-ssr 用例**: `dev-ssr/<bundler>-curl.test.ts`，调 `assertDevSSR`
4. **新增 HMR 用例**: `e2e/hmr-<bundler>.spec.ts`，调 `assertClientHMR(bundler, page)`

## 调试

- 测试失败时 `cat __tests__/integration/.tmp/<bundler>-<mode>-<rand>/dist/...` 查看产物
- `cleanup` 可在调试时注释掉保留 .tmp 目录
- Playwright trace: `pnpm exec playwright show-trace test-results/.../trace.zip`

## CI 集成

测试 fixtures 用 `link:` 协议引 monorepo 包，`pnpm install` 在 fixture 内秒级完成（无需 publish）。Playwright 浏览器走 `actions/setup-node` 自带缓存。

不支持 Windows（路径分隔符 + 端口冲突），仅 darwin/linux。
