# @bundlekit/plugin-svelte

Svelte 构建插件，为 BundleKit 提供 Svelte 项目模板和构建支持。

## 安装

```bash
npm install -D @bundlekit/plugin-svelte
# 或
pnpm add -D @bundlekit/plugin-svelte
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 Svelte 模板，插件会自动配置：

```bash
bc create my-app -t svelte-ts
```

### 手动配置

在 `.bundlekitrc.ts` 中添加插件：

```typescript
export default defineConfig({
  plugins: ['@bundlekit/plugin-svelte'],
});
```

## 功能特性

- ✅ Svelte 4+ 支持
- ✅ TypeScript / JavaScript 模板
- ✅ `.svelte` 单文件组件
- ✅ 热模块替换（HMR）
- ✅ SSR 支持
- ✅ 多页应用（MPA）支持

## 模板选项

| 模板 | 说明 |
|------|------|
| `svelte-ts` | Svelte + TypeScript |
| `svelte-js` | Svelte + JavaScript |

## 生成的项目结构

```
my-app/
├── src/
│   ├── index.ts          # 应用入口（SPA）
│   ├── App.svelte        # 根组件
│   ├── entry-client.ts   # SSR 客户端入口（可选）
│   └── entry-server.ts   # SSR 服务端入口（可选）
├── public/
│   └── index.html        # HTML 模板
└── .bundlekitrc.ts       # 构建配置
```

## SSR 支持

创建 SSR 项目：

```bash
bc create my-app -t svelte-ts --ssr
```

生成的配置：

```typescript
export default defineConfig({
  config: {
    production: {
      entry: 'src/entry-client.ts',
      ssr: {
        entry: 'src/entry-server.ts',
        output: { dir: 'dist/server', filename: 'server.cjs' },
      },
    },
  },
});
```

## 多页应用（MPA）

在 `.bundlekitrc.ts` 中声明多个 `pages` 即可：

```typescript
export default defineConfig({
  config: {
    production: {
      pages: [
        { entry: 'src/pages/home.ts', filename: 'home.html', template: 'public/home.html' },
        { entry: 'src/pages/about.ts', filename: 'about.html', template: 'public/about.html' },
      ],
    },
  },
});
```

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

MIT
