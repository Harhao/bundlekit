export default {
    mode: "production" as const,
    bundler: "rspack" as const,
    plugins: ["@bundlekit/plugin-angular"],
    config: {
        production: {
            target: "web" as const,
            framework: "angular" as const,
            publicPath: "/",
            entry: "shared-angular/src/main.ts",
            pages: [
                { entry: "shared-angular/src/main.ts", filename: "index.html", template: "shared-angular/public/index.html", inject: "body" as const },
            ],
            output: { dir: "dist", filename: "[name].js" },
            alias: {},
            externals: [],
            js: { sourcemap: false, minify: false, splitChunks: false },
        },
    } as any,
};
