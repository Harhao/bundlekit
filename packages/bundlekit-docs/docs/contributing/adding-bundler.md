---
title: 新增 Bundler 适配器
order: 4
---

# 新增 Bundler 适配器

bundlekit 通过 `IBuildToolAdapter` 接口统一所有打包器。新增 bundler 时只需实现该接口、注册短名映射、补集成测试 fixture。

## 1. IBuildToolAdapter 接口

```ts
export interface IBuildToolAdapter<T = any> {
    /** 适配器名（npm 包名） */
    name: string;

    /** 把抽象 IBuildConfig 转为 bundler 原生 config */
    transformConfig: (config: IBuildConfig) => T | Promise<T>;

    /** 校验 bundler 原生 config 与 buildConfig 是否合法 */
    validateConfig?: (config: T, buildConfig?: IBuildConfig) => boolean;

    /** 运行 bundler（dev / build） */
    run: (config: T) => Promise<void>;

    /**
     * dev SSR middleware（可选）
     * 启用 ssr.dev=true 时由 service 调用，返回 connect 风格中间件链
     */
    createSSRMiddleware?: (
        config: IBuildConfig,
        ctx: ISSRMiddlewareCtx,
    ) => Promise<IRequestHandler | IRequestHandler[]>;
}
```

## 2. 创建包目录

```bash
# 假设新增 esbuild adapter
mkdir -p packages/bundlekit-bundler-esbuild/src
mkdir packages/bundlekit-bundler-esbuild/scripts
```

`packages/bundlekit-bundler-esbuild/package.json`：

```json
{
    "name": "@bundlekit/bundler-esbuild",
    "version": "0.0.1",
    "main": "./dist/index.cjs",
    "module": "./dist/index.mjs",
    "exports": {
        ".": {
            "import": "./dist/index.mjs",
            "require": "./dist/index.cjs",
            "types": "./dist/index.d.ts"
        }
    },
    "files": ["dist"],
    "scripts": {
        "esbuild:build": "rollup -c ./scripts/rollup.config.js"
    },
    "dependencies": {
        "@bundlekit/shared-utils": "workspace:*",
        "esbuild": "^0.20.0"
    },
    "publishConfig": {
        "registry": "https://registry.npmjs.org/"
    }
}
```

## 3. 实现适配器

`packages/bundlekit-bundler-esbuild/src/index.ts`：

```ts
import { Logger, validateBuildConfig } from "@bundlekit/shared-utils";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv } from "@bundlekit/shared-utils";
import * as esbuild from "esbuild";

export default class EsbuildBundler implements IBuildToolAdapter<esbuild.BuildOptions> {
    private context: string;
    private mode: IBuildEnv;
    private logger = new Logger();
    public name = "@bundlekit/bundler-esbuild";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode = mode;
        this.context = api.context || process.cwd();
    }

    transformConfig(config: IBuildConfig): esbuild.BuildOptions {
        const env = config.config?.[this.mode] || config.config?.development;
        return {
            entryPoints: [env!.entry as string],
            outdir: env!.output.dir,
            bundle: true,
            format: "esm",
            // ...
        };
    }

    validateConfig(_, buildConfig) {
        return buildConfig ? validateBuildConfig(buildConfig, this.mode).valid : true;
    }

    async run(config: esbuild.BuildOptions) {
        if (this.mode === "development") {
            const ctx = await esbuild.context(config);
            await ctx.watch();
            this.logger.info("esbuild watching...");
        } else {
            await esbuild.build(config);
            this.logger.done("esbuild 构建完成");
        }
    }
}
```

## 4. 注册到 BUNDLER_PACKAGE_MAP

`packages/bundlekit-shared-utils/lib/types/cli-init/index.ts`：

```diff
  export const BUNDLER_PACKAGE_MAP: Record<IBuildTools, string> = {
      webpack:  "@bundlekit/bundler-webpack",
      vite:     "@bundlekit/bundler-vite",
      rspack:   "@bundlekit/bundler-rspack",
      rollup:   "@bundlekit/bundler-rollup",
      rolldown: "@bundlekit/bundler-rolldown",
+     esbuild:  "@bundlekit/bundler-esbuild",
  };
```

同步更新 `IBuildTools` 类型 union（adapter.ts）：

```diff
- export type IBuildTools = "vite" | "webpack" | "rollup" | "rspack" | "rolldown";
+ export type IBuildTools = "vite" | "webpack" | "rollup" | "rspack" | "rolldown" | "esbuild";
```

`IBundlerConfigMap` 加新条目：

```diff
  export type IBundlerConfigMap = {
      webpack: import("webpack").Configuration;
      vite: import("vite").InlineConfig;
      rspack: import("@rspack/core").RspackOptions;
      rollup: import("rollup").RollupOptions;
      rolldown: unknown;
+     esbuild: import("esbuild").BuildOptions;
  };
```

## 5. cli 集成

`packages/bundlekit-cli/lib/ui/CreateApp.tsx` 的 `BUNDLERS_*` 列表加新项：

```diff
- const BUNDLERS_PRIMARY: ISelectItem[] = [
+     { label: "Esbuild   —— 极速 native bundler", value: "esbuild" },
      ...
  ];
```

## 6. 集成测试 fixture

```bash
mkdir __tests__/integration/fixtures/esbuild
```

`__tests__/integration/fixtures/esbuild/package.json`：

```json
{
    "name": "bundlekit-fixture-esbuild",
    "private": true,
    "dependencies": {
        "react": "^18.3.0",
        "react-dom": "^18.3.0"
    },
    "devDependencies": {
        "@bundlekit/service": "link:../../../../packages/bundlekit-service",
        "@bundlekit/bundler-esbuild": "link:../../../../packages/bundlekit-bundler-esbuild",
        "@bundlekit/shared-utils": "link:../../../../packages/bundlekit-shared-utils",
        "@bundlekit/plugin-react": "link:../../../../packages/bundlekit-plugin-react"
    }
}
```

复制 `webpack/.bundlekitrc.{spa,lib,ssr}.ts` 到 `esbuild/`，把 `bundler` 字段改为 `"esbuild"`。

## 7. 集成测试 spec

```ts
// __tests__/integration/build/esbuild-spa.test.ts
import { describe, it } from "vitest";
import { assertSpaBuild } from "../helpers/buildAssertions";

describe("esbuild spa build", () => {
    it("produces expected spa artifacts and content", async () => {
        await assertSpaBuild("esbuild");
    });
});
```

同样的 lib / ssr / dev-ssr 测试。

## 8. SSR 支持（可选）

如果新 bundler 要支持 SSR，实现 `createSSRMiddleware`：

```ts
import { createSSRRequestHandler, buildSSRView } from "@bundlekit/shared-utils";

public async createSSRMiddleware(
    buildConfig: IBuildConfig,
    ctx: ISSRMiddlewareCtx,
): Promise<IRequestHandler[]> {
    const ssrConfig = buildConfig.config?.[this.mode]?.ssr;
    if (!ssrConfig) throw new Error("ssr config missing");

    // server pass：用 buildSSRView 转换 buildConfig
    const serverConfig = this.transformConfig(buildSSRView(buildConfig, this.mode));
    // 启动 watch + 异步等编译就绪
    // ...

    return [createSSRRequestHandler({
        context: this.context,
        ssrConfig,
        serverBundlePath: () => serverBundlePath,
        waitUntilReady,
    })];
}
```

## 9. turbo.json 注册

```diff
  {
      "tasks": {
+         "esbuild:build": {
+             "outputs": ["dist/**"]
+         }
      }
  }
```

## 10. changeset

```bash
pnpm changeset
# 选 @bundlekit/bundler-esbuild + @bundlekit/shared-utils + @bundlekit/cli
# 选 minor
# 写说明：Add esbuild bundler adapter
```

## 检查清单

- [ ] `packages/bundlekit-bundler-<name>/` 目录结构齐全
- [ ] `IBuildToolAdapter` 实现
- [ ] `BUNDLER_PACKAGE_MAP` 注册
- [ ] `IBuildTools` 类型 union 加入
- [ ] `IBundlerConfigMap` 加入
- [ ] cli `BUNDLERS_*` 列表加入
- [ ] fixture + 至少 SPA build 集成测试通过
- [ ] turbo.json 任务注册
- [ ] changeset 写好
- [ ] docs `bundlers.md` 介绍特性
