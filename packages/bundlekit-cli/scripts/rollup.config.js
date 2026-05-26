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
    input: resolve(__dirname, '../index.tsx'),
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
            jsx: 'react-jsx',
            jsxImportSource: 'react',
        }),
        terser(),
        header({
            header: `#!/usr/bin/env node\n`
        }),
    ],
    external: [
        'path',
        'crypto',
        'url',
        'fs',
        'tslib',
        '@bundlekit/shared-utils',
        '@bundlekit/bundler-webpack',
        '@bundlekit/bundler-vite',
        '@bundlekit/bundler-rollup',
        '@bundlekit/bundler-rspack',
        '@bundlekit/bundler-rolldown',
        '@bundlekit/bundler-parcel',
        '@bundlekit/bundler-esbuild',
        // ink + react: ESM-only，runtime 由 npm 安装
        'react',
        'react/jsx-runtime',
        'ink',
        'ink-select-input',
        'ink-text-input',
        'ink-spinner',
        'ink-gradient',
        'ink-big-text',
    ]
}

// ESM only output (cjs 已移除，遵循 change improve-cli-ux)
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