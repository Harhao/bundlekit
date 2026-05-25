# BundleKit 文档查询 Agent - 手动部署指南

## 前提条件

1. **Cloudflare 账户**
2. **Cloudflare API Token**（需要 Workers AI 和 Vectorize 权限）
3. **Wrangler CLI** 已安装并登录

## 部署步骤

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Wrangler

```bash
wrangler login
```

### 3. 设置环境变量

```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
export CLOUDFLARE_ACCOUNT_ID="你的账户ID"
export CLOUDFLARE_API_AI_TOKEN="你的API Token"

# 生效配置
source ~/.zshrc
```

### 4. 设置 API Token 为 Secret

```bash
# 在项目目录下运行
wrangler secret put CLOUDFLARE_API_AI_TOKEN
# 输入你的 API Token
```

### 5. 构建 Worker

```bash
# 进入项目目录
cd packages/bundlekit-docs-agent

# 安装依赖
pnpm install

# 构建 Worker
pnpm build:worker
```

### 6. 部署到 Cloudflare

```bash
# 使用 wrangler deploy
wrangler deploy

# 或使用 npm 脚本
pnpm deploy:worker
```

### 7. 验证部署

```bash
# 查看部署的 Worker
wrangler list

# 测试健康检查
curl https://bundlekit-docs-agent.你的子域名.workers.dev/health

# 测试查询
curl -X POST https://bundlekit-docs-agent.你的子域名.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a BundleKit project?"}'
```

## 配置文件

项目包含 `wrangler.toml` 配置文件，包含以下设置：

```toml
name = "bundlekit-docs-agent"
main = "dist/worker-rag.js"
compatibility_date = "2026-05-03"

[vars]
VECTORIZE_INDEX_NAME = "bundlekit-docs"
EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5"
CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct"
CLOUDFLARE_ACCOUNT_ID = "你的账户ID"
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/query` | POST | 查询文档 |
| `/docs` | GET | API 文档 |

## 故障排除

### 常见错误

1. **Embedding API error: 404 Not found**
   - 检查 `CLOUDFLARE_API_AI_TOKEN` 是否设置
   - 验证 token 权限（需要 Workers AI 权限）

2. **部署失败**
   - 确认 Wrangler 已登录：`wrangler whoami`
   - 检查环境变量是否设置

3. **查询失败**
   - 检查 Vectorize 索引是否存在：`wrangler vectorize list`

### 调试命令

```bash
# 查看实时日志
wrangler tail

# 查看部署状态
wrangler list

# 检查 secrets
wrangler secret list

# 检查环境变量
wrangler whoami
```

## 更新部署

修改代码后，重新构建并部署：

```bash
# 重新构建
pnpm build:worker

# 重新部署
wrangler deploy
```

## 清理

如果需要删除部署的 Worker：

```bash
wrangler delete bundlekit-docs-agent
```