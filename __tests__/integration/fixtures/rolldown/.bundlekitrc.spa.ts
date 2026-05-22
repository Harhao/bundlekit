export default {
    mode: "production" as const,
    bundler: "rolldown" as const,
    plugins: ["@bundlekit/plugin-react"],
    config: {
        production: {
            target: "web" as const,
            publicPath: "/",
            entry: "shared/src/entry-client.tsx",
            pages: [
                { entry: "shared/src/entry-client.tsx", filename: "index.html", template: "shared/public/index.html", inject: "body" as const },
            ],
            output: { dir: "dist", filename: "[name].js", formats: "umd" as const },
            alias: {},
            externals: [],
            js: { sourcemap: false, minify: false, splitChunks: false },
        },
    } as any,
};
