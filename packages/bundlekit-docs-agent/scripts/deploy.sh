#!/bin/bash

# BundleKit 文档查询 Agent 部署脚本

set -e

echo "🚀 BundleKit 文档查询 Agent 部署脚本"
echo "======================================"

# 检查环境变量
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ] || [ -z "$CLOUDFLARE_API_AI_TOKEN" ]; then
    echo "❌ 错误：请设置 CLOUDFLARE_ACCOUNT_ID 和 CLOUDFLARE_API_AI_TOKEN 环境变量"
    echo ""
    echo "设置方法："
    echo "  export CLOUDFLARE_ACCOUNT_ID=your_account_id"
    echo "  export CLOUDFLARE_API_AI_TOKEN=your_api_token"
    echo ""
    echo "或创建 .env 文件（参考 .env.example）"
    exit 1
fi

echo "✅ 环境变量已设置"

# 构建项目
echo "🔨 构建项目..."
pnpm build

# 索引文档（如果需要）
echo "📚 检查文档索引..."
if [ ! -f ".vectorize-index-created" ]; then
    echo "📥 索引文档中..."
    pnpm ingest
    touch .vectorize-index-created
    echo "✅ 文档索引完成"
else
    echo "✅ 文档索引已存在"
fi

# 启动代理
echo "🤖 启动文档查询代理..."
echo ""
echo "提示：输入 'exit' 退出代理"
echo ""

pnpm agent