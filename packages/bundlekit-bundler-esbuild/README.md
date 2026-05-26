# @bundlekit/bundler-esbuild

esbuild 打包器适配器，为 @bundlekit/service 提供 esbuild 构建支持。

## 安装

```bash
pnpm add -D @bundlekit/bundler-esbuild
```

## 使用

```bash
bc create my-app -b esbuild
# 或手动指定
bundlekit-service serve --bundler esbuild
bundlekit-service build --bundler esbuild
```

## 功能特性

- ✅ esbuild 0.20+ 支持
- ✅ 极速编译（Go 实现，比 tsc/babel 快 10-100x）
- ✅ TypeScript / JavaScript / JSX / TSX 原生支持
- ✅ CSS / CSS Modules 原生支持
- ✅ 图片/字体等静态资源（dataurl 内联）
- ✅ SSE 热更新（watch + DevServer）
- ✅ SSR 支持
- ✅ Library 模式
- ✅ Code splitting（ESM 格式）

## 配置示例

```typescript
// .bundlekitrc.ts
import type { IBuildConfig } from "@bundlekit/shared-utils";

const config: IBuildConfig = {
  bundler: "esbuild",
  plugins: ["@bundlekit/plugin-react"],
  config: {
    development: {
      entry: "src/index.tsx",
      output: { dir: "dist", filename: "[name].js", formats: "esm" },
      devServer: { host: "0.0.0.0", port: 3000 },
    },
    production: {
      entry: "src/index.tsx",
      output: { dir: "dist", filename: "[name].js", formats: "esm" },
      js: { minify: true },
    },
  },
};

export default config;
```

## Library 模式

```typescript
const config: IBuildConfig = {
  bundler: "esbuild",
  config: {
    production: {
      entry: "src/index.ts",
      output: { dir: "dist", filename: "index.js", formats: "cjs" },
      library: true,
    },
  },
};
```

## 与其他 bundler 对比

| 特性 | esbuild | Vite | Webpack |
|------|---------|------|---------|
| 编译速度 | 极快（Go） | 快 | 慢 |
| HMR | SSE reload | 原生 HMR | 原生 HMR |
| CSS Modules | ✅ 原生 | ✅ | 需 loader |
| Less/Sass | 需插件 | ✅ | 需 loader |
| 生产优化 | 基础 minify | 完整 | 最丰富 |

## 注意事项

- Less / Sass 需额外安装 esbuild 插件（`esbuild-plugin-less` / `esbuild-plugin-sass`）
- UMD 格式以 `iife` 兜底输出

## License

MIT
