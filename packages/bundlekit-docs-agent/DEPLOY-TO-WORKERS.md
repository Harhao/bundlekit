# 部署到 Cloudflare Workers 指南

## 概述

本指南将指导您将 BundleKit 文档查询 Agent 部署为 Cloudflare Worker。

## 前提条件

1. Cloudflare 账户
2. Cloudflare API Token（需要 Workers AI 和 Vectorize 权限）
3. Wrangler CLI（Cloudflare 的命令行工具）
4. Node.js 18+ 版本

## 步骤 1：安装 Wrangler CLI

```bash
npm install -g wrangler
```

## 步骤 2：登录 Wrangler

```bash
wrangler login
```

这将打开浏览器进行 Cloudflare 账户认证。

## 步骤 3：配置环境变量

### 3.1 设置敏感环境变量（推荐）
在 `~/.zshrc` 中添加以下环境变量：

```bash
# 编辑 ~/.zshrc 文件
nano ~/.zshrc

# 添加以下行
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_AI_TOKEN=your_api_token

# 使配置生效
source ~/.zshrc
```

### 3.2 配置非敏感环境变量
确保 `.env` 文件包含以下非敏感配置：

```env
VECTORIZE_INDEX_NAME=bundlekit-docs
EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5
CHAT_MODEL=@cf/meta/llama-3.1-8b-instruct
PORT=4111
```

注意：敏感凭证（`CLOUDFLARE_ACCOUNT_ID` 和 `CLOUDFLARE_API_AI_TOKEN`）已从 `.env` 文件中移除，必须从环境变量中读取。

## 步骤 4：验证 Vectorize 索引

确保 Vectorize 索引已创建：

```bash
# 检查索引是否存在
wrangler vectorize list

# 如果不存在，创建索引
wrangler vectorize create bundlekit-docs --dimensions=768 --metric=cosine
```

## 步骤 5：构建 Worker

```bash
# 安装依赖
pnpm install

# 构建 Worker
pnpm build:worker
```

## 步骤 6：本地测试

在部署前，可以使用 Wrangler 的开发模式进行测试：

```bash
# 启动本地开发服务器
wrangler dev

# 测试健康检查
curl http://localhost:8787/health

# 测试查询接口
curl -X POST http://localhost:8787/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a BundleKit project?"}'
```

## 步骤 7：部署到 Cloudflare

### 方法 1：使用 Wrangler CLI

```bash
# 部署 Worker
wrangler deploy

# 查看部署信息
wrangler list
```

### 方法 2：使用 GitHub Actions

工作流文件已配置好：`.github/workflows/deploy-docs-agent.yml`

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_AI_TOKEN`

推送代码到 `master` 分支将自动触发部署。

### 方法 3：使用 npm 脚本

```bash
# 使用预配置的脚本
pnpm deploy:worker
```

## 步骤 8：验证部署

部署成功后，访问以下端点：

1. **健康检查**：
   ```
   https://your-worker-name.your-subdomain.workers.dev/health
   ```

2. **API 文档**：
   ```
   https://your-worker-name.your-subdomain.workers.dev/docs
   ```

3. **测试查询**：
   ```bash
   curl -X POST https://your-worker-name.your-subdomain.workers.dev/query \
     -H "Content-Type: application/json" \
     -d '{"question": "How do I configure BundleKit?"}'
   ```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/` | GET | 服务信息 |
| `/health` | GET | 健康检查 |
| `/query` | POST | 查询文档 |
| `/docs` | GET | API 文档 |

## 查询请求格式

```json
{
  "question": "你的问题",
  "maxResults": 3
}
```

## 查询响应格式

```json
{
  "question": "你的问题",
  "answer": "AI 生成的回答",
  "sources": [
    {
      "source": "guide/cli.md",
      "score": 0.85
    }
  ],
  "timestamp": "2026-05-25T15:00:00.000Z"
}
```

## 自定义配置

### 修改模型

在 `wrangler.toml` 中更新环境变量：

```toml
[vars]
EMBEDDING_MODEL = "@cf/baai/bge-large-en-v1.5"
CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct"
```

### 自定义域名

在 Cloudflare 控制台：
1. 进入 Workers & Pages
2. 选择你的 Worker
3. 点击 "Settings" → "Triggers"
4. 添加自定义域名

## 监控和日志

### 查看日志

```bash
# 实时查看日志
wrangler tail

# 查看特定环境的日志
wrangler tail --env production
```

### 监控指标

在 Cloudflare 控制台的 Workers & Pages → 你的 Worker → Analytics 中查看：
- 请求数
- 错误率
- 执行时间
- CPU 使用率

## 故障排除

### 常见问题

1. **部署失败**：
   - 检查 Wrangler 是否已登录
   - 验证 API Token 权限
   - 确认账户 ID 正确

2. **查询失败**：
   - 检查 Vectorize 索引是否存在
   - 验证 Workers AI 模型权限
   - 查看 Wrangler 日志

3. **CORS 错误**：
   - Worker 已配置 CORS 头
   - 如果仍有问题，检查请求头

### 调试步骤

1. 本地测试：
   ```bash
   wrangler dev
   ```

2. 查看实时日志：
   ```bash
   wrangler tail
   ```

3. 检查环境变量：
   ```bash
   wrangler secret list
   ```

## 性能优化

1. **启用缓存**：考虑使用 KV 存储缓存常用查询
2. **批量处理**：批量处理多个嵌入请求
3. **模型选择**：根据需求选择合适的模型大小
4. **超时设置**：调整 Worker 超时时间（最多 30 秒）

## 安全注意事项

1. **API Token**：使用最小权限的 API Token
2. **CORS**：生产环境限制 CORS 来源
3. **速率限制**：考虑添加速率限制
4. **输入验证**：验证和清理所有输入

## 成本估算

Cloudflare Workers 定价：
- 免费套餐：100,000 请求/天
- 付费套餐：$5/月，包含 1000 万请求

Cloudflare Workers AI 定价：
- 按使用量计费
- 嵌入模型：约 $0.0001/1K tokens
- 聊天模型：约 $0.002/1K tokens

Cloudflare Vectorize 定价：
- 存储：$0.01/百万向量/月
- 查询：$0.01/百万查询