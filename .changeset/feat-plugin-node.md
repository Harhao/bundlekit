---
"@bundlekit/cli": patch
"@bundlekit/plugin-react": patch
"@bundlekit/plugin-vue": patch
---

feat(plugin-node): 新增 @bundlekit/plugin-node，支持纯 TypeScript / Node.js 项目模板

新增 `@bundlekit/plugin-node` 插件，为 Node.js 工具库、CLI、后端服务等场景提供纯 TypeScript 项目脚手架。

### 新增内容

**`packages/bundlekit-plugin-node`**（全新包）：
- `index.ts`：插件主入口，给所有 env 打 `framework='node'` 标记，并移除 devServer 配置（Node 库不需要本地开发服务）
- `generator/index.ts`：CLI create 流程回调，调用 `addPluginToConfig` 自动写入 `.bundlekitrc.ts`
- `templates/template-node-ts/`：模板文件集合
  - `.bundlekitrc.ts.ejs`：按 `library` 模式分支生成配置：
    - 普通模式：`target: "node"`, `formats: ["esm", "commonjs"]`，双格式输出，无 HTML 入口
    - Library 模式：额外加 `library: true` + `libraryName`，适合发布到 npm 的 SDK
  - `src/index.ts.ejs`：应用入口（含 `greet` / `add` 示例 + `isMain` 判断，可直接 `node` 运行）
  - `src/lib-entry.ts.ejs`：库入口（`--lib` 模式由 generator 重命名为 `src/index.ts`，re-export `utils.ts` + 默认导出命名空间）
  - `src/utils.ts`：基础工具函数（`greet` / `add`，作为 SDK 函数示例）
  - `tsconfig.json`：Node 友好的 TS 配置（`target: ES2020`，`module: NodeNext`，开 `declaration + declarationMap`）
  - `package.json.ejs`：含 `"type": "module"` + `exports` 字段（`import`/`require`/`default` 三条路径）+ `typecheck` script

**CLI 改动**：
- `index.tsx`：TEMPLATES 新增 `node-ts`（显示名：Node.js / 纯 TypeScript（无框架））
- `lib/commands/create/actions.ts`：
  - `normalizeTemplate` 加 `node` / `node-ts` 别名
  - `resolvePluginPkgName` 加 `node-*` → `@bundlekit/plugin-node` 分支
  - 错误提示加入 `node-ts`
- `lib/utils/generatorRunner.ts`：重构 generator 查找逻辑，从「`require.resolve` subpath exports」改为「先 resolve `package.json` 定位包根目录，再拼接 `generator/index.ts|js|cjs|mjs`，最后用 jiti 加载」—— 彻底解决 `.ts` 源文件无法被原生 `import()` 加载的问题，同时兼容 monorepo 和已发布场景
- `package.json`：`dependencies` 增加 `@bundlekit/plugin-node: workspace:*`

**plugin-react / plugin-vue package.json**：加 `exports` 字段（`"./generator": "./generator/index.ts"`），让 `require.resolve` 能正常解析 generator 子路径（为 generatorRunner 重构预留）

### 使用方式

```bash
# 普通 Node.js / 纯 TS 项目
bc create my-ts-app -t node-ts -b rollup

# SDK / 库项目（双格式 esm + cjs，无 HTML）
bc create my-ts-sdk -t node-ts -b rollup --lib --library-name MySDK
```

### 测试覆盖

新增 8 个集成测试：
- `__tests__/integration/cli/cli-plugin-node.test.ts`：7 个 CLI create 场景用例（普通模式 / library 模式 / 文件结构 / `.bundlekitrc.ts` 内容 / `package.json` 结构）
- `__tests__/integration/build/node-lib.test.ts`：1 个 build 测试（rollup 打 node library，require 出 `add(2,3)===5`）

59 单元 + 45 集成全部通过（1 parcel UMD skip 为已知缺口）。
