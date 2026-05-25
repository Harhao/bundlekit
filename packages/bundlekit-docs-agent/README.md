# BundleKit 文档查询 Agent

基于 Mastra 框架和 Cloudflare Workers AI 构建的文档查询 Agent，提供 RAG（检索增强生成）功能。

## 🚀 快速开始

### 1. 配置环境变量
在 `~/.zshrc` 中添加以下环境变量：
```bash
# 编辑 ~/.zshrc 文件
nano ~/.zshrc

# 添加以下行
export CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
export CLOUDFLARE_API_AI_TOKEN=your_cloudflare_api_token

# 使配置生效
source ~/.zshrc
```

注意：敏感凭证已从 `.env` 文件中移除，仅保留非敏感配置。

### 2. 索引文档（首次使用前）
```bash
pnpm ingest
```

### 3. 启动交互式代理
```bash
pnpm agent
```

## 📋 部署

本项目使用 GitHub Actions 自动部署到 Cloudflare Workers。

### 配置 GitHub Secrets
在仓库设置中添加：
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_AI_TOKEN`

### 自动部署
当代码推送到 `master` 分支且修改了 `packages/bundlekit-docs-agent/` 目录时，会自动触发部署。

### 手动部署
在 GitHub 仓库的 Actions 页面手动触发部署。

## 📖 使用方式

### 交互式命令行
```bash
pnpm agent
```

### HTTP API
部署后，Agent 提供以下 API 端点：

- **健康检查**：`GET /health`
- **查询文档**：`POST /query`
- **API 文档**：`GET /docs`

示例：
```bash
curl -X POST https://your-worker.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a BundleKit project?"}'
```

## 🛠️ 开发

### 本地测试
```bash
# 测试 Cloudflare 连接
pnpm test:cloudflare

# 测试 Worker 本地运行
pnpm test:worker

# 测试权限
pnpm tsx test/test-permissions.ts
```

### 项目结构
```
packages/bundlekit-docs-agent/
├── src/              # 源代码
├── test/             # 测试脚本
├── scripts/          # 部署脚本
├── dist/             # 构建输出
└── *.md              # 文档文件
```

## 📚 详细文档

- **Cloudflare Workers 详细部署指南**：`DEPLOY-TO-WORKERS.md`
- **测试说明**：`test/README.md`

## 🔧 环境变量

### 敏感环境变量（必须在 ~/.zshrc 中设置）
| 变量名 | 描述 |
|--------|------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |
| `CLOUDFLARE_API_AI_TOKEN` | Cloudflare API Token（具有 Workers AI 和 Vectorize 权限） |

### 非敏感环境变量（可在 .env 文件中设置）
| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `VECTORIZE_INDEX_NAME` | bundlekit-docs | Vectorize 索引名称 |
| `EMBEDDING_MODEL` | @cf/baai/bge-base-en-v1.5 | 嵌入模型 |
| `CHAT_MODEL` | @cf/meta/llama-3.1-8b-instruct | 聊天模型 |
| `PORT` | 4111 | 本地服务器端口 |