# @bundlekit/bundler-rollup

Rollup 打包器适配器，为 @bundlekit/service 提供 Rollup 4 构建支持。

## 安装

```bash
npm install -D @bundlekit/bundler-rollup
# 或
pnpm add -D @bundlekit/bundler-rollup
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 rollup：

```bash
bc create my-app -b rollup
```

### 手动配置

在 `.bundlekitrc.ts` 中指定 bundler：

```bash
ds serve --bundler rollup
ds build --bundler rollup
```

## 功能特性

- ✅ Rollup 4 支持
- ✅ Tree Shaking
- ✅ ES Module 输出
- ✅ TypeScript / JavaScript
- ✅ CSS / Less / Sass
- ✅ Library 模式
- ✅ SSR 支持
- ✅ 插件生态丰富

## 配置示例

```typescript
export default defineConfig({
  config: {
    production: {
      entry: 'src/index.tsx',
      output: {
        dir: 'dist',
        filename: '[name].js',
        formats: 'esm',
      },
    },
  },
  tools: {
    rollup: (config) => {
      // 修改 rollup 配置
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
| `tools.rollup` | rollup 原生配置修改钩子 |
| `library` | 启用 Library 模式 |
| `libraryName` | UMD/IIFE 模式导出名称 |
| `output.formats` | 输出格式（esm/commonjs/umd/iife） |

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

ISC
