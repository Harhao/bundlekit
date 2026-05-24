import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { spawnSync } from 'child_process';
import path from 'path';

const TEMPLATES = ['react-ts', 'react-js', 'vue3-ts', 'vue3-js'] as const;
const BUNDLERS = ['vite', 'webpack', 'rspack', 'rollup', 'rolldown'] as const;
const PACKAGE_MANAGERS = ['pnpm', 'yarn', 'npm'] as const;

export const createProjectTool = createTool({
  id: 'createProject',
  description: '创建一个新的前端项目，由 bundlekit 驱动。支持 React 和 Vue 模板，可选择多种构建工具。',
  inputSchema: z.object({
    name: z.string().describe('项目名称（允许小写字母、数字、@、.、-、_）'),
    template: z.enum(TEMPLATES).optional().describe('项目模板：react-ts、react-js、vue3-ts 或 vue3-js'),
    bundler: z.enum(BUNDLERS).optional().describe('构建工具：vite、webpack、rspack、rollup 或 rolldown'),
    description: z.string().optional().describe('项目描述'),
    packageManager: z.enum(PACKAGE_MANAGERS).optional().describe('包管理器：pnpm、yarn 或 npm'),
    ssr: z.boolean().optional().describe('启用 SSR（服务端渲染）'),
    cwd: z.string().optional().describe('项目创建的工作目录'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    projectPath: z.string().optional(),
  }),
  execute: async (inputData) => {
    const { name, template, bundler, description, packageManager, ssr, cwd } = inputData;

    try {
      // 构建参数
      const args = ['create', name];
      if (template) args.push('-t', template);
      if (bundler) args.push('-b', bundler);
      if (description) args.push('-d', description);
      if (packageManager) args.push('--pm', packageManager);
      else args.push('--pm', 'npm'); // 默认使用 npm，避免交互式提示
      if (ssr) args.push('--ssr');

      // 使用 bundlekit-cli 命令
      const result = spawnSync('bundlekit-cli', args, {
        cwd: cwd || process.cwd(),
        env: {
          ...process.env,
          DEVKIT_NO_INK: '1',
          DEVKIT_NO_PROMPT: '1',
          DEVKIT_QUIET: '1',
          DEVKIT_SKIP_INSTALL: '1',
        },
        stdio: 'pipe',
        shell: true,
      });

      const stdout = result.stdout?.toString() || '';
      const stderr = result.stderr?.toString() || '';

      if (result.status !== 0) {
        throw new Error(stderr || stdout || '命令执行失败');
      }

      const projectPath = path.resolve(cwd || process.cwd(), name);

      return {
        success: true,
        message: `项目 "${name}" 创建成功，使用 ${template || 'react-ts'} 模板和 ${bundler || 'webpack'} 构建工具`,
        projectPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `创建项目失败：${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
