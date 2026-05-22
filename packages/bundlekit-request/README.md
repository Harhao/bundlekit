# @bundlekit/request

HTTP 客户端运行时库，支持 axios/fetch 双引擎，为 BundleKit 项目提供统一的请求接口。

## 安装

```bash
npm install @bundlekit/request
# 或
pnpm add @bundlekit/request
```

## 使用

### 基本用法

```typescript
import request from '@bundlekit/request';

// GET 请求
const data = await request.get('/api/users');

// POST 请求
const result = await request.post('/api/users', {
  name: 'John',
  email: 'john@example.com',
});

// PUT 请求
await request.put('/api/users/1', { name: 'Jane' });

// DELETE 请求
await request.delete('/api/users/1');
```

### 配置选项

```typescript
import request from '@bundlekit/request';

// 创建实例
const api = request.create({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 使用实例
const data = await api.get('/users');
```

### 拦截器

```typescript
import request from '@bundlekit/request';

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 添加 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 统一错误处理
    console.error('请求失败:', error.message);
    return Promise.reject(error);
  }
);
```

## API

### request.get(url[, config])

发起 GET 请求。

### request.post(url[, data[, config]])

发起 POST 请求。

### request.put(url[, data[, config]])

发起 PUT 请求。

### request.delete(url[, config])

发起 DELETE 请求。

### request.create(config)

创建一个新的 axios 实例。

## 文档

完整文档请访问 [https://bundlekit.dev](https://bundlekit.dev)

## License

ISC
