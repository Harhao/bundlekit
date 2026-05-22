import type { IBuildConfig } from "@bundlekit/shared-utils";

const pages = [
  {
    filename: "index.html",
    template: "public/index.html",
    entry: "src/index.tsx",
    inject: "body" as const,
  },
];

const baseEnvConfig = {
  target: "web" as const,
  entry: "src/index.tsx",
  pages,
  alias: { "@": "src" },
  externals: [] as string[],
  output: {
    dir: "dist",
    filename: "[name].js",
    formats: "umd" as const,
  },
};

const config: IBuildConfig = {
  bundler: "webpack",
  mode: "development",
  plugins: ["@bundlekit/plugin-react", "@bundlekit/plugin-mock"],
  tools: {
    webpack(webpackConfig, ctx) {
      // change 2 验证：tools.webpack hook 在 transform 之后执行
      console.log(`[tools.webpack] ctx=${ctx.mode}/${ctx.command}/${ctx.env}/${ctx.bundler}`);
      (webpackConfig as any).__bundlekitFlag = true;
    },
    vite(viteConfig, ctx) {
      console.log(`[tools.vite] ctx=${ctx.mode}/${ctx.command}/${ctx.env}/${ctx.bundler}`);
    },
  },
  changeConfigure: (webpackConfig, mode) => {
    // change 2 验证：changeConfigure 在 tools 之后执行，应该能看到 tools 设的 flag
    if ((webpackConfig as any).__bundlekitFlag) {
      console.log(`[changeConfigure] tools 钩子先于 changeConfigure 执行 ✓`);
      // 清理掉验证用的 flag 避免 webpack 报错
      delete (webpackConfig as any).__bundlekitFlag;
    }
    if (mode === "production") {
      return { ...webpackConfig, devtool: false } as any;
    }
    return webpackConfig;
  },
  config: {
    development: {
      ...baseEnvConfig,
      publicPath: "/",
      js: { sourcemap: false, minify: false, splitChunks: true },
      css: { sourcemap: false, modules: true, extract: true, loaders: ["css", "less"] },
      devServer: {
        host: "0.0.0.0",
        port: 3000,
        https: false,
        open: true,
        proxy: {
          "/api": { target: "http://localhost:4000", changeOrigin: true, secure: false },
        },
      },
      inject: { position: "head", js: [{ src: "https://cdn.example.com/init.js", defer: true }] },
    },
    production: {
      ...baseEnvConfig,
      publicPath: "/",
      output: { ...baseEnvConfig.output, filename: "[name].[contenthash:8].js" },
      js: { sourcemap: false, minify: true, splitChunks: true },
      css: { sourcemap: false, modules: true, extract: true, loaders: ["css", "less"] },
      analyzer: true,
      devServer: { host: "0.0.0.0", port: 3000, https: false, open: false, proxy: {} },
    },
    test: {
      ...baseEnvConfig,
      publicPath: "/",
      js: { sourcemap: false, minify: false, splitChunks: false },
    },
    staging: {
      ...baseEnvConfig,
      publicPath: "/",
      output: { ...baseEnvConfig.output, filename: "[name].[contenthash:8].js" },
      js: { sourcemap: false, minify: true, splitChunks: true },
    },
    gray: {
      ...baseEnvConfig,
      publicPath: "/",
      output: { ...baseEnvConfig.output, filename: "[name].[contenthash:8].js" },
      js: { sourcemap: false, minify: true, splitChunks: true },
    },
  },
};

export default config;
