# @bundlekit/plugin-react

React 构建插件，为 BundleKit 提供 React 项目模板和构建支持。

## 安装

```bash
npm install -D @bundlekit/plugin-react
# 或
pnpm add -D @bundlekit/plugin-react
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 React 模板，插件会自动配置：

```bash
bc create my-app -t react-ts
```

### 手动配置

在 `.bundlekitrc.ts` 中添加插件：

```typescript
export default defineConfig({
  plugins: ['@bundlekit/plugin-react'],
});
```

## 功能特性

- ✅ React 18+ 支持
- ✅ TypeScript / JavaScript 模板
- ✅ JSX/TSX 自动转换
- ✅ 热模块替换（HMR）
- ✅ SSR 支持

## 模板选项

| 模板 | 说明 |
|------|------|
| `react-ts` | React + TypeScript |
| `react-js` | React + JavaScript |

## 生成的项目结构

```
my-app/
├── src/
│   ├── index.tsx          # 应用入口
│   ├── App.tsx            # 根组件
│   ├── entry-client.tsx   # SSR 客户端入口（可选）
│   └── entry-server.tsx   # SSR 服务端入口（可选）
├── public/
│   └── index.html         # HTML 模板
├── mock/
│   └── index.ts           # Mock 数据
└── .bundlekitrc.ts        # 构建配置
```

## SSR 支持

创建 SSR 项目：

```bash
bc create my-app -t react-ts --ssr
```

生成的配置：

```typescript
export default defineConfig({
  config: {
    production: {
      entry: 'src/entry-client.tsx',
      ssr: {
        entry: 'src/entry-server.tsx',
        output: { dir: 'dist/server', filename: 'server.cjs' },
      },
    },
  },
});
```

## 文档

完整文档请访问 [https://bundlekit.dev](https://bundlekit.dev)

## License

ISC
