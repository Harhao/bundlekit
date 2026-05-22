# @bundlekit/plugin-vue

Vue 3 构建插件，为 BundleKit 提供 Vue 3 项目模板和构建支持。

## 安装

```bash
npm install -D @bundlekit/plugin-vue
# 或
pnpm add -D @bundlekit/plugin-vue
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 Vue 模板：

```bash
bc create my-app -t vue3-ts
```

### 手动配置

在 `.bundlekitrc.ts` 中添加插件：

```typescript
export default defineConfig({
  plugins: ['@bundlekit/plugin-vue'],
});
```

## 功能特性

- ✅ Vue 3.5+ 支持
- ✅ TypeScript / JavaScript 模板
- ✅ SFC（单文件组件）支持
- ✅ 热模块替换（HMR）
- ✅ SSR 支持
- ✅ Vue TSC 类型检查

## 模板选项

| 模板 | 说明 |
|------|------|
| `vue3-ts` | Vue 3 + TypeScript |
| `vue3-js` | Vue 3 + JavaScript |

## 生成的项目结构

```
my-app/
├── src/
│   ├── main.ts            # 应用入口
│   ├── App.vue            # 根组件
│   ├── entry-client.ts    # SSR 客户端入口（可选）
│   └── entry-server.ts    # SSR 服务端入口（可选）
├── public/
│   └── index.html         # HTML 模板
├── mock/
│   └── index.ts           # Mock 数据
└── .bundlekitrc.ts        # 构建配置
```

## SSR 支持

创建 SSR 项目：

```bash
bc create my-app -t vue3-ts --ssr
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

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

ISC
