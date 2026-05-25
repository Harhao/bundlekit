这个文件夹包含了 BundleKit 文档查询 agent 的各种测试和演示脚本。

## 文件说明

### 测试脚本

1. **test-cloudflare.ts** - 测试 Cloudflare API 基本连接
2. **test-permissions.ts** - 测试 Cloudflare API 权限（Workers AI 和 Vectorize）
3. **test-agent.ts** - 测试 Mastra agent 功能（需要正确的模型配置）

### 演示脚本

1. **simple-agent.ts** - 简单的 Cloudflare Workers AI 调用演示
2. **rag-agent.ts** - 完整的 RAG（检索增强生成）流程演示
3. **interactive-agent.ts** - 交互式命令行界面，可用于实际查询文档

## 使用方法

### 运行测试脚本

```bash
# 测试 Cloudflare 连接
pnpm test:cloudflare

# 运行权限测试
pnpm tsx test/test-permissions.ts

# 测试基本 Cloudflare API
pnpm tsx test/test-cloudflare.ts
```

### 运行演示脚本

```bash
# 简单的 Cloudflare AI 调用
pnpm tsx test/simple-agent.ts

# RAG 演示
pnpm tsx test/rag-agent.ts

# 交互式代理（推荐）
pnpm agent
```

### 交互式代理

启动交互式代理后，你可以输入关于 BundleKit 文档的问题，例如：
- "How do I create a new BundleKit project?"
- "What bundlers are supported by BundleKit?"
- "How do I configure BundleKit SSR?"

输入 `exit` 退出。

## 前置条件

1. 已完成文档索引（运行 `pnpm ingest`）
2. 已设置正确的环境变量（`.env` 文件）
3. Cloudflare API token 具有必要的权限