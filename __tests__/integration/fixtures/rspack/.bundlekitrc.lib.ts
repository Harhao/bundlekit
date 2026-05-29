export default {
    mode: "production" as const,
    bundler: "rspack" as const,
    plugins: ["@bundlekit/plugin-react"],
    config: {
        production: {
            target: "node" as const,
            publicPath: "/",
            entry: "shared/src/index.ts",
            output: { dir: "dist", filename: "lib.cjs", formats: "commonjs" as const },
            alias: {},
            externals: [],
            // 显式 library: true — 触发 bundler 的 library 输出（CJS module.exports 暴露），
            // 让 require('./dist/lib.cjs').add(2,3) 能拿到函数。否则 target=node 走的是
            // Node 应用 build，bundle 内部 export 不会暴露到 module.exports。
            library: true,
            js: { sourcemap: false, minify: false, splitChunks: false },
        },
    } as any,
};
