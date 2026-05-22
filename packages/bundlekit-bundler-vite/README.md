# @bundlekit/bundler-vite

Vite 打包器适配器，为 @bundlekit/service 提供 Vite 构建支持。

## 安装

```bash
npm install -D @bundlekit/bundler-vite
# 或
pnpm add -D @bundlekit/bundler-vite
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 vite：

```bash
bc create my-app -b vite
```

### 手动配置

在 `.bundlekitrc.ts` 中指定 bundler：

```bash
ds serve --bundler vite
ds build --bundler vite
```

## 功能特性

- ✅ Vite 4+ 支持
- ✅ 原生 ESM 开发
- ✅ 极速热更新（HMR）
- ✅ TypeScript / JavaScript
- ✅ CSS / Less / Sass
- ✅ Vue / React 插件支持
- ✅ SSR 支持
- ✅ 多页面应用（MPA）

## 配置示例

```typescript
export default defineConfig({
  config: {
    development: {
      entry: 'src/index.tsx',
      output: { dir: 'dist', filename: '[name].js' },
      devServer: {
        port: 3000,
        open: true,
      },
    },
    production: {
      entry: 'src/index.tsx',
      output: { dir: 'dist', filename: '[name].[hash].js' },
    },
  },
  tools: {
    vite: (config) => {
      // 修改 vite 配置
      return config;
    },
  },
});
```

## 特有配置

| 配置项 | 说明 |
|--------|------|
| `tools.vite` | vite 原生配置修改钩子 |
| `pages` | 多页面应用配置 |
| `devServer.https` | HTTPS 配置 |

## 多页面应用

```typescript
export default defineConfig({
  config: {
    production: {
      pages: [
        { entry: 'src/main.ts', inject: { title: 'Home' } },
        { entry: 'src/about.ts', inject: { title: 'About' } },
      ],
    },
  },
});
```

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

ISC
