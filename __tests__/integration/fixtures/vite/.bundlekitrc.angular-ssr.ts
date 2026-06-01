export default {
    mode: "production" as const,
    bundler: "vite" as const,
    plugins: ["@bundlekit/plugin-angular"],
    config: {
        production: {
            target: "web" as const,
            framework: "angular" as const,
            publicPath: "/",
            entry: "shared-angular/src/entry-client.ts",
            output: { dir: "dist/client", filename: "[name].js", formats: "esm" as const },
            alias: {},
            externals: [],
            js: { sourcemap: false, minify: false, splitChunks: false },
            ssr: {
                entry: "shared-angular/src/entry-server.ts",
                output: { dir: "dist/server", filename: "server.cjs", formats: "commonjs" as const },
                externals: "auto" as const,
                template: "shared-angular/public/index.html",
                placeholder: "<!--ssr-outlet-->",
            },
        },
    } as any,
};
