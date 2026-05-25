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

# 测试查询（非流式）
curl -X POST https://bundlekit-docs-agent.你的子域名.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a BundleKit project?", "stream": false}'

# 测试查询（流式）
curl -X POST https://bundlekit-docs-agent.你的子域名.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a BundleKit project?", "stream": true}'
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
| `/query` | POST | 查询文档（支持流式输出） |
| `/docs` | GET | API 文档 |

## 流式输出

查询端点支持流式输出，通过 `stream: true` 参数启用。

### 请求格式

```json
{
  "question": "你的问题",
  "maxResults": 3,
  "stream": true
}
```

### 响应格式

流式响应使用 Server-Sent Events (SSE) 格式：

1. **元数据行**：包含问题、来源和时间戳
   ```json
   {"type":"metadata","data":{"question":"...","sources":[...],"timestamp":"..."}}
   ```

2. **数据块行**：包含AI生成的内容片段
   ```json
   {"type":"chunk","data":"data: {\"response\":\"...\",\"p\":\"...\"}\n\n"}
   ```

3. **完成行**：表示流式输出结束
   ```json
   {"type":"done"}
   ```

### 使用示例

```bash
# 流式输出
curl -X POST https://bundlekit-docs-agent.harhao.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a BundleKit project?", "stream": true}'

# 非流式输出（默认）
curl -X POST https://bundlekit-docs-agent.harhao.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a BundleKit project?", "stream": false}'
```

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

4. **流式输出问题**
   - 确保请求包含 `"stream": true`
   - 检查响应头：`Content-Type: text/event-stream`
   - 如果流式输出中断，检查 Wrangler 日志

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