# @bundlekit/bundler-webpack

Webpack 打包器适配器，为 @bundlekit/service 提供 Webpack 5 构建支持。

## 安装

```bash
npm install -D @bundlekit/bundler-webpack
# 或
pnpm add -D @bundlekit/bundler-webpack
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 webpack：

```bash
bc create my-app -b webpack
```

### 手动配置

在 `.bundlekitrc.ts` 中指定 bundler：

```bash
ds serve --bundler webpack
ds build --bundler webpack
```

## 功能特性

- ✅ Webpack 5 支持
- ✅ TypeScript / JavaScript
- ✅ CSS / Less / Sass
- ✅ 热模块替换（HMR）
- ✅ 代码分割（Code Splitting）
- ✅ 资源优化（Minification）
- ✅ Source Map
- ✅ SSR 支持
- ✅ Bundle 分析

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
    webpack: (config) => {
      // 修改 webpack 配置
      return config;
    },
  },
});
```

## 特有配置

| 配置项 | 说明 |
|--------|------|
| `tools.webpack` | webpack 原生配置修改钩子 |
| `js.splitChunks` | 代码分割配置 |
| `js.sourcemap` | Source Map 配置 |

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

ISC
