const { resolve } = require("path");

const json = require('@rollup/plugin-json');
const terser = require('@rollup/plugin-terser');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const nodeResolve = require('@rollup/plugin-node-resolve');

// 自定义插件，只在入口文件添加 shebang
const shebangPlugin = () => ({
    name: 'shebang',
    renderChunk(code, chunk) {
        if (chunk.isEntry && [
            'index.cjs', 
            'index.mjs',
        ].includes(chunk.fileName)) {
            return `#!/usr/bin/env node\n${code}`;
        }
        return code;
    }
});

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
        // terser(),
        shebangPlugin(),
    ],
    external: [
        'path',
        'crypto',
        'url',
        'fs',
        'tslib',
        'jiti',
        '@bundlekit/shared-utils',
        '@bundlekit/bundler-webpack',
        '@bundlekit/bundler-vite',
        '@bundlekit/bundler-rollup',
        '@bundlekit/bundler-rspack',
        '@bundlekit/bundler-rolldown'
    ]
}

module.exports = [
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
            chunkFileNames: 'chunks/[name]-[hash].cjs',
            dynamicImportInCjs: false,
            interop: 'auto'
        },
    }
];