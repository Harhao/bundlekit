const json = require("@rollup/plugin-json");
const terser = require("@rollup/plugin-terser");
const typescript = require('@rollup/plugin-typescript');

const { resolve } = require('path');

const getRollupConfig = async() => {
    return [
        {
            input: resolve(__dirname, `../src/index.ts`),
            onwarn(warning, warn) {
                if (warning.code === 'CIRCULAR_DEPENDENCY') return;
                warn(warning);
            },
            output: [
                {
                    file: "dist/index.mjs",
                    format: "es",
                },
                {
                    file: "dist/index.js",
                    format: "cjs",
                },
            ],
            plugins: [
                typescript({
                    tsconfig: resolve(__dirname, '../tsconfig.json'),
                }),
                json(),
                terser(),
            ],
            external: [
                'path',
                'fs',
                'crypto',
                'module',
                '@bundlekit/shared-utils',
                '@parcel/core',
                '@parcel/config-default',
            ],
        },
    ];
};

module.exports = getRollupConfig();
