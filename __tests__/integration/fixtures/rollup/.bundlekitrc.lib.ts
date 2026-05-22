export default {
    mode: "production" as const,
    bundler: "rollup" as const,
    plugins: ["@bundlekit/plugin-react"],
    config: {
        production: {
            target: "node" as const,
            publicPath: "/",
            entry: "shared/src/index.ts",
            output: { dir: "dist", filename: "lib.cjs", formats: "commonjs" as const },
            alias: {},
            externals: [],
            js: { sourcemap: false, minify: false, splitChunks: false },
        },
    } as any,
};
