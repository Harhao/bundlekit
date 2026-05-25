#!/bin/bash

# 测试 Cloudflare Worker 部署
echo "🧪 测试 Cloudflare Worker 部署"
echo "==============================="

# 检查 Wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安装"
    echo "请运行: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI 已安装"

# 检查是否已登录
if ! wrangler whoami &> /dev/null; then
    echo "❌ 未登录 Wrangler"
    echo "请运行: wrangler login"
    exit 1
fi

echo "✅ 已登录 Wrangler"

# 构建 Worker
echo "🔨 构建 Worker..."
pnpm build:worker

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo "✅ 构建成功"

# 本地测试
echo "🔍 本地测试..."
wrangler dev --port 8787 &
DEV_PID=$!

# 等待服务器启动
sleep 3

# 测试健康检查
echo "测试健康检查端点..."
curl -s http://localhost:8787/health | jq '.' || echo "响应：$(curl -s http://localhost:8787/health)"

# 测试查询端点
echo -e "\n测试查询端点..."
curl -s -X POST http://localhost:8787/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I create a BundleKit project?"}' | jq '.' || echo "响应：$(curl -s -X POST http://localhost:8787/query -H 'Content-Type: application/json' -d '{"question": "How do I create a BundleKit project?"}')"

# 停止本地服务器
kill $DEV_PID 2>/dev/null

echo -e "\n✅ 本地测试完成"
echo ""
echo "🚀 要部署到 Cloudflare，请运行："
echo "   pnpm deploy:worker"
echo ""
echo "📋 部署后测试："
echo "   curl https://your-worker.workers.dev/health"