import { resolve } from 'node:path';
import { fileURLToPath } from "node:url";
import { header } from 'rollup-plugin-header'

import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';


const __dirname = fileURLToPath(new URL('.', import.meta.url));

const commonConfig = {
    input: resolve(__dirname, '../src/index.ts'),
    onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
    },
    plugins: [
        nodeResolve({
            preferBuiltins: true,
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
        }),
        commonjs({
            extensions: ['.js', '.ts', '.tsx'],
            ignoreDynamicRequires: true
        }),
        json(),
        typescript({
            tsconfig: './tsconfig.json',
            sourceMap: false,
            importHelpers: true,
            declaration: true,
            declarationDir: 'dist/types',
        }),
        terser(),
        // header({
        //     header: `#!/usr/bin/env node\n`
        // }),
    ],
    external: [
        'path',
        'crypto',
        'url',
        'fs',
        'tslib',
        '@mastra/mcp',
        '@mastra/core',
        '@mastra/core/tools',
        '@bundlekit/cli',
        '@bundlekit/shared-utils',
        'zod',
    ]
}

// 仅输出 ESM 格式
export default [
    {
        ...commonConfig,
        output: {
            dir: "dist",
            format: "es",
            sourcemap: false,
            entryFileNames: '[name].mjs',
            chunkFileNames: 'chunks/[name]-[hash].mjs'
        },
    },
];
