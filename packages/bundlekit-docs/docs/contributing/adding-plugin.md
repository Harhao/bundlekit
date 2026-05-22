---
title: 新增 Plugin
order: 5
---

# 新增 Plugin

bundlekit 的插件分两种：

- **构建插件**（`@bundlekit/plugin-react` / `@bundlekit/plugin-vue`）：通过 `framework` 字段告知 bundler 如何处理 jsx/vue
- **运行时插件**（`@bundlekit/plugin-mock`）：用户项目运行时挂钩

本指南聚焦"构建插件"。

## 1. PluginAPI 接口

构建插件的核心是 `apply(api, config)` 函数：

```ts
export interface IRegisterPlugin {
    id: string;
    apply: (api: IPluginAPIClass, config: IBuildConfig) => void;
    defaultModes?: Record<string, IBuildEnv>;
}

export interface IPluginAPIClass {
    /** 服务实例（不要直接修改 buildConfig） */
    service: IService;
    /** 注册子命令 */
    registerCommand: (name: string, options: any, fn: Function) => void;
    /** 修改 buildConfig（链式安全） */
    modifyBuildConfig: (mutator: (config: IBuildConfig) => void) => void;
}
```

## 2. 创建包目录

```bash
mkdir -p packages/bundlekit-plugin-svelte/{src,templates}
```

`packages/bundlekit-plugin-svelte/package.json`：

```json
{
    "name": "@bundlekit/plugin-svelte",
    "version": "0.0.1",
    "main": "./index.ts",
    "type": "module",
    "dependencies": {
        "@bundlekit/shared-utils": "workspace:*",
        "svelte": "^4.0.0"
    },
    "publishConfig": {
        "registry": "https://registry.npmjs.org/"
    }
}
```

## 3. 实现 plugin

`packages/bundlekit-plugin-svelte/index.ts`：

```ts
import type { IPluginAPIClass, IBuildConfig } from "@bundlekit/shared-utils";

export default {
    id: "@bundlekit/plugin-svelte",
    defaultModes: {},
    apply: (api: IPluginAPIClass, config: IBuildConfig) => {
        // 写 framework 字段，bundler 适配器读到后会自动注入 svelte loader
        api.modifyBuildConfig((cfg) => {
            const env = cfg.config?.[cfg.mode];
            if (env) {
                (env as any).framework = "svelte";
            }
        });
    },
};
```

## 4. bundler 端识别 framework 字段

每个 bundler 在 `transformConfig` 里读 `framework` 决定加什么 loader / plugin。例如 webpack：

```diff
  // packages/bundlekit-bundler-webpack/src/transformConfig.ts
  private transformScriptRules() {
      const framework = (this.buildConfig as any).framework as string;
+     if (framework === "svelte") {
+         return [{
+             test: /\.svelte$/,
+             loader: "svelte-loader",
+         }];
+     }
      // ...
  }
```

vite / rspack / rollup / rolldown 都需类似添加（用对应生态的 svelte 插件）。

## 5. 模板目录

模板放在 `packages/bundlekit-plugin-svelte/templates/template-svelte-ts/`：

```
template-svelte-ts/
├── .bundlekitrc.ts.ejs
├── package.json.ejs
├── tsconfig.json
├── public/
│   └── index.html.ejs
└── src/
    ├── App.svelte
    ├── entry-client.ts.ejs       # SSR 用
    ├── entry-server.ts.ejs       # SSR 用
    └── index.ts.ejs              # SPA 用
```

`package.json.ejs`：

```ejs
{
    "name": "<%= projectName %>",
    "version": "1.0.0",
    "scripts": {
        "clean": "rimraf dist",
        "dev": "bundlekit-service serve --bundler <%= bundler %> --mode development",
        "build": "bundlekit-service build --bundler <%= bundler %> --mode production"
    },
    "dependencies": {
        "svelte": "^4.0.0"
    },
    "devDependencies": {
        "@bundlekit/service": "workspace:^",
        "@bundlekit/plugin-svelte": "workspace:^",
        "rimraf": "^5.0.1",
        "typescript": "^5.8.0"
    }
}
```

> 💡 关键：`@bundlekit/*` 用 `workspace:^` 协议，cli 在生成时会自动 normalize 成 link 或 ^cliVersion。详见 [发版流程](./release)。

`.bundlekitrc.ts.ejs`（条件 ssr 块）：

```ejs
export default {
    mode: "development" as const,
    bundler: "<%= bundler %>",
    plugins: ["@bundlekit/plugin-svelte"],
    config: {
        development: {
            target: "web" as const,
            entry: <% if (ssr) { %>"src/entry-client.ts"<% } else { %>"src/index.ts"<% } %>,
            // ...
        },
    } as any,
};
```

## 6. cli 端注册模板

`packages/bundlekit-cli/lib/commands/create/actions.ts` 的 `resolvePluginPkgName`：

```diff
  export function resolvePluginPkgName(template: string): string {
      const normalized = normalizeTemplate(template);
+     if (normalized.startsWith("svelte")) return "@bundlekit/plugin-svelte";
      return normalized.startsWith("vue") ? "@bundlekit/plugin-vue" : "@bundlekit/plugin-react";
  }
```

`normalizeTemplate` 加别名：

```diff
  const aliases: Record<string, string> = {
+     "svelte-ts": "svelte-ts",
+     "svelte-js": "svelte-js",
+     svelte: "svelte-ts",
      ...
  };
```

`CreateApp.tsx` 的 `TEMPLATES` 加新选项：

```diff
  const TEMPLATES: ISelectItem[] = [
      { label: "React + TypeScript", value: "react-ts" },
      ...
+     { label: "Svelte + TypeScript", value: "svelte-ts" },
+     { label: "Svelte + JavaScript", value: "svelte-js" },
  ];
```

## 7. generator hook（可选）

如果 plugin 需要在 cli 创建后追加额外文件 / 装额外依赖，写一个 `generate(api)` 函数：

```ts
// packages/bundlekit-plugin-svelte/index.ts
export default {
    apply: (...) => { ... },

    /** cli create 命令在模板渲染完后调用 */
    generate: async (api: IGeneratorAPI) => {
        // 例如：根据用户选择追加 svelte-routing 依赖
        if (api.options.useRouter) {
            api.addDependency("svelte-spa-router", "^4.0.0");
        }
    },
};
```

`api` 由 `buildGeneratorAPI(targetDir, logger)` 创建，提供：
- `addDependency(name, version)` — 写入 dependencies
- `addDevDependency(name, version)` — 写入 devDependencies
- `extendPackage(json)` — 任意合并到 package.json
- `render(template, target, context)` — 追加渲染模板文件

## 8. changeset

```bash
pnpm changeset
# 选 @bundlekit/plugin-svelte + 各 bundler-* + @bundlekit/cli + @bundlekit/shared-utils
# 选 minor
# 写说明：Add Svelte framework plugin
```

## 检查清单

- [ ] `packages/bundlekit-plugin-<framework>/` 目录结构齐全
- [ ] `apply` 写 `framework` 字段
- [ ] 各 bundler `transformConfig` 加 framework 分支
- [ ] 模板目录 + `.bundlekitrc.ts.ejs` + `package.json.ejs`
- [ ] cli `resolvePluginPkgName` / `normalizeTemplate` / `TEMPLATES` 注册
- [ ] 集成测试 fixture（可选，SPA + Library + SSR 三档）
- [ ] changeset 写好
- [ ] docs `plugins.md` 简介
