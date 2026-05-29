export default {
    mode: "development" as const,
    bundler: "rollup" as const,
    plugins: ["@bundlekit/plugin-react"],
    config: {
        development: {
            target: "web" as const,
            publicPath: "/",
            entry: "shared/src/entry-client.tsx",
            pages: [
                { entry: "shared/src/entry-client.tsx", filename: "index.html", template: "shared/public/index.html", inject: "body" as const },
            ],
            output: { dir: "dist", filename: "[name].js", formats: "esm" as const },
            alias: {},
            externals: [],
            js: { sourcemap: false, minify: false, splitChunks: false },
            devServer: { open: false, proxy: {}, https: false, host: "127.0.0.1", port: 0 },
        },
    } as any,
};
