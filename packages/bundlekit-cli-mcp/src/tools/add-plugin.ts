import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { spawnSync } from 'child_process';

const PLUGINS = ['mock', 'react', 'vue', 'request'] as const;
const BUNDLERS = ['vite', 'webpack', 'rspack', 'rollup', 'rolldown'] as const;

export const addPluginTool = createTool({
  id: 'addPlugin',
  description: '向已有的 bundlekit 项目添加插件或构建工具适配器。支持框架插件（react、vue、mock、request）和构建工具适配器。',
  inputSchema: z.object({
    plugin: z.string().describe('要添加的插件或构建工具名称（例如：react、vue、mock、request、vite、webpack、rspack、rollup、rolldown）'),
    cwd: z.string().optional().describe('已有项目的工作目录'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    pluginName: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { plugin, cwd } = inputData;

    try {
      // 使用 bundlekit-cli 命令
      const result = spawnSync('bundlekit-cli', ['add', plugin], {
        cwd: cwd || process.cwd(),
        env: {
          ...process.env,
          DEVKIT_NO_INK: '1',
          DEVKIT_NO_PROMPT: '1',
          DEVKIT_QUIET: '1',
        },
        stdio: 'pipe',
        shell: true,
      });

      if (result.status !== 0) {
        const stderr = result.stderr?.toString() || '';
        const stdout = result.stdout?.toString() || '';
        throw new Error(stderr || stdout || '命令执行失败');
      }

      return {
        success: true,
        message: `插件 "${plugin}" 已成功添加到项目`,
        pluginName: plugin,
      };
    } catch (error) {
      return {
        success: false,
        message: `添加插件失败：${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
