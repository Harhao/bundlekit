import { resolve } from 'node:path';
import { fileURLToPath } from "node:url";

import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';


const __dirname = fileURLToPath(new URL('.', import.meta.url));

const commonConfig = {
    input: resolve(__dirname, '../index.ts'),
    onwarn(warning, warn) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        warn(warning);
    },
    plugins: [
        nodeResolve({
            preferBuiltins: true,
            extensions: ['.ts', '.js', '.json']
        }),
        commonjs({
            extensions: ['.js', '.ts'],
            ignoreDynamicRequires: true
        }),
        json(),
        typescript({
            tsconfig: './tsconfig.json',
            sourceMap: false,
            importHelpers: true
        }),
        terser()
    ],
    external: [
        'path',
        'crypto',
        'url',
        'fs',
        'tslib',
        'child_process',
        'cli-progress'
    ]
}

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
    {
        ...commonConfig,
        output: {
            dir: "dist",
            format: "cjs",
            sourcemap: false,
            entryFileNames: '[name].cjs',
            chunkFileNames: 'chunks/[name]-[hash].cjs'
        },
    }
];