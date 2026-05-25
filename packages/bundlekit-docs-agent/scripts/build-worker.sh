#!/bin/bash

# 构建 Cloudflare Worker
echo "🔨 构建 Cloudflare Worker..."

# 清理 dist 目录
rm -rf dist

# 创建 dist 目录
mkdir -p dist

# 使用 esbuild 打包 TypeScript 文件
npx esbuild src/worker-rag.ts --bundle --outfile=dist/worker-rag.js --format=esm --target=es2020

# 复制其他必要文件
cp src/worker.ts dist/worker.js 2>/dev/null || true

echo "✅ 构建完成！"
echo "📦 输出文件："
ls -la dist/