# @bundlekit/plugin-mock

Mock 插件，为 BundleKit 提供本地 Mock API 服务器和代理配置。

## 安装

```bash
npm install -D @bundlekit/plugin-mock
# 或
pnpm add -D @bundlekit/plugin-mock
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时会自动包含 Mock 数据：

```bash
bc create my-app -t react-ts
```

### 手动配置

在 `.bundlekitrc.ts` 中添加插件：

```typescript
export default defineConfig({
  plugins: ['@bundlekit/plugin-mock'],
});
```

## 功能特性

- ✅ 基于 json-server 的 Mock API
- ✅ 热重载 Mock 数据
- ✅ 代理配置支持
- ✅ RESTful API 自动生成

## Mock 数据

在项目根目录创建 `mock/db.json`：

```json
{
  "users": [
    { "id": 1, "name": "John", "email": "john@example.com" },
    { "id": 2, "name": "Jane", "email": "jane@example.com" }
  ],
  "posts": [
    { "id": 1, "title": "Hello", "content": "World" }
  ]
}
```

## API 路由

启动开发服务后，自动可用的 API：

```
GET    /users
GET    /users/:id
POST   /users
PUT    /users/:id
DELETE /users/:id
```

## 代理配置

在 `.bundlekitrc.ts` 中配置代理：

```typescript
export default defineConfig({
  config: {
    development: {
      devServer: {
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          },
        },
      },
    },
  },
});
```

## 使用场景

- 前后端分离开发
- API 接口联调
- 单元测试 Mock

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

ISC
