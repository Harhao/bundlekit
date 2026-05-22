# @bundlekit/service

BundleKit 核心服务，提供开发服务和生产构建功能，支持 5 种主流打包器。

## 安装

```bash
npm install -D @bundlekit/service
# 或
pnpm add -D @bundlekit/service
```

## 使用

### 开发服务

```bash
ds serve
ds serve --bundler vite
ds serve --bundler webpack --https
```

### 生产构建

```bash
ds build
ds build --bundler vite --mode production
ds build --bundler rspack --mode staging
```

### 命令行选项

| 命令 | 说明 |
|------|------|
| `ds serve` | 启动开发服务 |
| `ds build` | 执行生产构建 |

| 选项 | 说明 |
|------|------|
| `--bundler` | 指定打包器（vite/webpack/rspack/rollup/rolldown） |
| `--mode` | 构建模式（development/production/staging） |
| `--https` | 启用 HTTPS |
| `--skip-plugin` | 跳过指定插件 |

## 配置文件

在项目根目录创建 `.bundlekitrc.ts`：

```typescript
import { defineConfig } from '@bundlekit/service';

export default defineConfig({
  config: {
    development: {
      entry: 'src/index.tsx',
      output: { dir: 'dist', filename: '[name].js' },
      devServer: {
        open: true,
        port: 3000,
      },
    },
    production: {
      entry: 'src/index.tsx',
      output: { dir: 'dist', filename: '[name].[hash].js' },
      minify: true,
      sourcemap: false,
    },
  },
});
```

## SSR 支持

所有 5 个 bundler 都支持 SSR 双产物构建：

```typescript
export default defineConfig({
  config: {
    production: {
      entry: 'src/entry-client.tsx',
      output: { dir: 'dist/client', filename: '[name].js' },
      ssr: {
        entry: 'src/entry-server.tsx',
        output: { dir: 'dist/server', filename: 'server.cjs' },
        externals: 'auto',
      },
    },
  },
});
```

## 插件系统

支持动态加载插件：

```typescript
export default defineConfig({
  plugins: [
    '@bundlekit/plugin-react',
    '@bundlekit/plugin-mock',
  ],
});
```

## 文档

完整文档请访问 [https://bundlekit.dev](https://bundlekit.dev)

## License

ISC
