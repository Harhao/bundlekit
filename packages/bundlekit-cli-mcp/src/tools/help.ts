import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const helpTool = createTool({
  id: 'help',
  description: '获取 bundlekit-cli 命令和选项的帮助信息',
  inputSchema: z.object({
    command: z.string().optional().describe('要获取帮助的特定命令（例如：create、add）'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async (inputData) => {
    const { command } = inputData;

    try {
      let helpText = '';

      if (!command || command === 'create') {
        helpText += `
bundlekit-cli create <name>
创建一个新的前端项目

选项：
  -t, --template <template>  模板类型 (react-ts, react-js, vue3-ts, vue3-js, svelte-ts, svelte-js)
  -b, --bundler <bundler>    默认构建工具 (vite, webpack, rspack, rollup, rolldown)
  -d, --description <desc>   项目描述
  --pm <pm>                  包管理器 (pnpm, yarn, npm)
  --ssr                      启用 SSR
`;
      }

      if (!command || command === 'add') {
        helpText += `
bundlekit-cli add <plugin>
向已有项目添加插件或构建工具适配器

可用插件：
  - react: React 框架插件
  - vue: Vue 框架插件
  - svelte: Svelte 框架插件
  - mock: Mock 数据插件
  - request: 请求库插件

可用构建工具适配器：
  - vite, webpack, rspack, rollup, rolldown
`;
      }

      if (!command || command === 'help') {
        helpText += `
bundlekit-cli help [command]
获取帮助信息
`;
      }

      if (!command || command === 'version') {
        helpText += `
bundlekit-cli version
显示版本信息
`;
      }

      return {
        success: true,
        message: helpText.trim() || '没有可用的帮助信息',
      };
    } catch (error) {
      return {
        success: false,
        message: `获取帮助信息失败：${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
