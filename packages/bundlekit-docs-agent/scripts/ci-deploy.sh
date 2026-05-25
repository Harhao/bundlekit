#!/bin/bash

# CI 部署脚本 - 用于 GitHub Actions
set -e

echo "🚀 BundleKit 文档查询 Agent CI 部署"
echo "===================================="

# 检查环境变量
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ] || [ -z "$CLOUDFLARE_API_AI_TOKEN" ]; then
    echo "❌ 错误：CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_AI_TOKEN 未设置"
    exit 1
fi

echo "✅ 环境变量已设置"

# 构建项目
echo "🔨 构建项目..."
pnpm build

# 测试 Cloudflare 连接
echo "🔍 测试 Cloudflare 连接..."
pnpm test:cloudflare

# 索引文档（可选）
if [ "$SKIP_INGEST" != "true" ]; then
    echo "📚 索引文档..."
    pnpm ingest
else
    echo "⏭️  跳过文档索引（SKIP_INGEST=true）"
fi

echo "✅ CI 部署完成！"
echo ""
echo "📋 部署信息："
echo "   - 分支: ${GITHUB_REF:-unknown}"
echo "   - 提交: ${GITHUB_SHA:-unknown}"
echo "   - 时间: $(date)"