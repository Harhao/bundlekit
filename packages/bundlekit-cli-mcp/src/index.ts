#!/usr/bin/env node

import { bundlekitMcpServer } from './server';

export { bundlekitMcpServer };
export * from './tools';

// 直接运行时使用 stdio 传输启动 MCP 服务器
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  console.error('BundleKit MCP Server starting...');
  bundlekitMcpServer.startStdio().then(() => {
    console.error('BundleKit MCP Server started');
  }).catch((error) => {
    console.error('BundleKit MCP 服务器启动失败:', error);
    process.exit(1);
  });
}
