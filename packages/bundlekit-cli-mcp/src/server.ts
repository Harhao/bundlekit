import { MCPServer } from '@mastra/mcp';
import { createProjectTool, addPluginTool, listTemplatesTool, helpTool } from './tools';

export const bundlekitMcpServer = new MCPServer({
  id: 'bundlekit-mcp-server',
  name: 'BundleKit MCP 服务器',
  version: '0.0.1',
  description: 'BundleKit CLI 的 MCP 服务器 - 提供创建前端项目和管理插件的工具',
  instructions: `
此 MCP 服务器提供用于 BundleKit（前端项目脚手架工具）的工具。

可用工具：
- createProject：创建新的前端项目，支持 React、Vue、Svelte 模板
- addPlugin：向已有项目添加插件或构建工具适配器
- listTemplates：列出所有可用的模板、构建工具和包管理器
- help：获取 bundlekit-cli 命令的帮助信息

请先使用 listTemplates 了解可用选项，然后使用 createProject 创建新项目。
  `,
  tools: {
    createProject: createProjectTool,
    addPlugin: addPluginTool,
    listTemplates: listTemplatesTool,
    help: helpTool,
  },
});
