# @bundlekit/bundler-rspack

Rspack 打包器适配器，为 @bundlekit/service 提供 Rspack 构建支持。

## 安装

```bash
npm install -D @bundlekit/bundler-rspack
# 或
pnpm add -D @bundlekit/bundler-rspack
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 rspack：

```bash
bc create my-app -b rspack
```

### 手动配置

在 `.bundlekitrc.ts` 中指定 bundler：

```bash
ds serve --bundler rspack
ds build --bundler rspack
```

## 功能特性

- ✅ Rspack 1.3+ 支持
- ✅ 兼容 Webpack 配置
- ✅ 极速构建（Rust 实现）
- ✅ TypeScript / JavaScript
- ✅ CSS / Less / Sass
- ✅ 热模块替换（HMR）
- ✅ SSR 支持

## 配置示例

```typescript
export default defineConfig({
  config: {
    production: {
      entry: 'src/index.tsx',
      output: { dir: 'dist', filename: '[name].[hash].js' },
      minify: true,
      sourcemap: false,
    },
  },
  tools: {
    rspack: (config) => {
      // 修改 rspack 配置（兼容 webpack 配置格式）
      return config;
    },
  },
});
```

## 特有配置

| 配置项 | 说明 |
|--------|------|
| `tools.rspack` | rspack 原生配置修改钩子 |
| `js.splitChunks` | 代码分割配置 |
| `js.sourcemap` | Source Map 配置 |

## 与 Webpack 的区别

Rspack 是 Rust 实现的打包器，兼容 Webpack 配置格式，但构建速度更快：

| 特性 | Webpack | Rspack |
|------|---------|--------|
| 语言 | JavaScript | Rust |
| 构建速度 | 较慢 | 极快 |
| 配置兼容 | - | 兼容 Webpack |
| 内存占用 | 较高 | 较低 |

## 文档

完整文档请访问 [https://bundlekit.dev](https://bundlekit.dev)

## License

ISC
