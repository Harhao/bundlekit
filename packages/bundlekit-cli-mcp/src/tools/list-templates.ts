import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const listTemplatesTool = createTool({
  id: 'listTemplates',
  description: '列出所有可用的 bundlekit 项目模板。用于发现创建新项目时可使用的模板选项。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    templates: z.array(z.object({
      name: z.string(),
      description: z.string(),
    })),
    bundlers: z.array(z.object({
      name: z.string(),
      description: z.string(),
    })),
    packageManagers: z.array(z.object({
      name: z.string(),
      description: z.string(),
    })),
  }),
  execute: async () => {
    return {
      templates: [
        { name: 'react-ts', description: 'React + TypeScript 模板' },
        { name: 'react-js', description: 'React + JavaScript 模板' },
        { name: 'vue3-ts', description: 'Vue 3 + TypeScript 模板' },
        { name: 'vue3-js', description: 'Vue 3 + JavaScript 模板' },
        { name: 'svelte-ts', description: 'Svelte + TypeScript 模板' },
        { name: 'svelte-js', description: 'Svelte + JavaScript 模板' },
        { name: 'angular-ts', description: 'Angular 17+ + TypeScript 模板（standalone）' },
        { name: 'angular-js', description: 'Angular 17+ + JavaScript 模板（standalone）' },
      ],
      bundlers: [
        { name: 'vite', description: 'Vite - 下一代前端构建工具' },
        { name: 'webpack', description: 'Webpack - JavaScript 模块打包器' },
        { name: 'rspack', description: 'Rspack - 基于 Rust 的快速 Web 打包器' },
        { name: 'rollup', description: 'Rollup - JavaScript 模块打包器' },
        { name: 'rolldown', description: 'Rolldown - 基于 Rust 的快速 JavaScript 打包器' },
      ],
      packageManagers: [
        { name: 'pnpm', description: 'pnpm - 快速、节省磁盘空间的包管理器' },
        { name: 'yarn', description: 'Yarn - 快速、可靠、安全的依赖管理工具' },
        { name: 'npm', description: 'npm - Node.js 包管理器' },
      ],
    };
  },
});
