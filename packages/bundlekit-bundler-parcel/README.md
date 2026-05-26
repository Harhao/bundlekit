# @bundlekit/bundler-parcel

Parcel 2 打包器适配器，为 @bundlekit/service 提供 Parcel 构建支持。

## 安装

```bash
npm install -D @bundlekit/bundler-parcel
# 或
pnpm add -D @bundlekit/bundler-parcel
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 parcel：

```bash
bc create my-app -b parcel
```

### 手动配置

在 `.bundlekitrc.ts` 中指定 bundler：

```bash
bundlekit-service serve --bundler parcel
bundlekit-service build --bundler parcel
```

## 功能特性

- ✅ Parcel 2.x 支持
- ✅ 零配置理念，自动处理资源
- ✅ TypeScript / JavaScript
- ✅ CSS / Less / Sass（自动安装 transformer）
- ✅ SSE 热更新
- ✅ SSR 支持
- ✅ Library 模式

## 配置示例

```typescript
// .bundlekitrc.ts
import type { IBuildConfig } from "@bundlekit/shared-utils";

const config: IBuildConfig = {
  bundler: "parcel",
  plugins: ["@bundlekit/plugin-react"],
  config: {
    development: {
      entry: "src/index.tsx",
      output: { dir: "dist", filename: "[name].js", formats: "umd" },
      devServer: { host: "0.0.0.0", port: 3000 },
    },
    production: {
      entry: "src/index.tsx",
      output: { dir: "dist", filename: "[name].js", formats: "umd" },
      js: { minify: true },
    },
  },
};

export default config;
```

## Library 模式

```typescript
const config: IBuildConfig = {
  bundler: "parcel",
  config: {
    production: {
      entry: "src/index.ts",
      output: { dir: "dist", filename: "index.js", formats: "commonjs" },
      library: true,
    },
  },
};
```

## 特有配置

| 配置项 | 说明 |
|--------|------|
| `library` | 启用 Library 模式（输出 commonjs） |
| `js.minify` | 开启代码压缩（生产模式默认开启） |
| `js.sourcemap` | 生成 source map |

## 与其他 bundler 的对比

| 特性 | Parcel | Vite | Webpack |
|------|--------|------|---------|
| 配置量 | 极少 | 少 | 多 |
| 冷启动 | 快 | 极快 | 慢 |
| 资源处理 | 自动 | 需配置 | 需 loader |
| 生态 | 中等 | 丰富 | 最丰富 |

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

MIT
