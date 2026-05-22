# @bundlekit/bundler-rolldown

Rolldown 打包器适配器，为 @bundlekit/service 提供 Rolldown 构建支持。

## 安装

```bash
npm install -D @bundlekit/bundler-rolldown
# 或
pnpm add -D @bundlekit/bundler-rolldown
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 rolldown：

```bash
bc create my-app -b rolldown
```

### 手动配置

在 `.bundlekitrc.ts` 中指定 bundler：

```bash
ds serve --bundler rolldown
ds build --bundler rolldown
```

## 功能特性

- ✅ Rolldown 1.0+ 支持
- ✅ Rust 实现，极速构建
- ✅ Rollup 兼容 API
- ✅ TypeScript / JavaScript
- ✅ CSS / Less / Sass
- ✅ SSE 热更新
- ✅ SSR 支持
- ✅ Library 模式
- ✅ HTML 手动生成

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
    rolldown: (config) => {
      // 修改 rolldown 配置
      return config;
    },
  },
});
```

## Library 模式

```typescript
export default defineConfig({
  config: {
    production: {
      entry: 'src/index.ts',
      output: {
        dir: 'dist',
        filename: 'index.js',
        formats: 'esm',
      },
      library: true,
      libraryName: 'MyLibrary',
    },
  },
});
```

## 特有配置

| 配置项 | 说明 |
|--------|------|
| `tools.rolldown` | rolldown 原生配置修改钩子 |
| `library` | 启用 Library 模式 |
| `libraryName` | UMD/IIFE 模式导出名称 |
| `output.formats` | 输出格式（esm/commonjs/umd/iife） |

## 与 Rollup 的区别

Rolldown 是 Rust 实现的打包器，API 兼容 Rollup，但性能更好：

| 特性 | Rollup | Rolldown |
|------|--------|----------|
| 语言 | JavaScript | Rust |
| 构建速度 | 较慢 | 极快 |
| API 兼容 | - | 兼容 Rollup |
| 内存占用 | 较高 | 较低 |

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

ISC
