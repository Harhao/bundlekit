export default {
    mode: "production" as const,
    bundler: "rspack" as const,
    plugins: ["@bundlekit/plugin-react"],
    config: {
        production: {
            target: "web" as const,
            publicPath: "/",
            entry: "shared/src/index.ts",
            output: { dir: "dist", filename: "[name].js", formats: "umd" as const },
            alias: {},
            externals: ["react", "react-dom"],
            library: true,
            libraryName: "MyLib",
            js: { sourcemap: false, minify: false, splitChunks: false },
        },
    } as any,
};
