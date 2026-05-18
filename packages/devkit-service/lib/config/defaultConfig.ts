import { IBuildConfig } from "@devkit/shared-utils";

export const getDefaultConfig = (context: string): IBuildConfig => ({
  mode: "development",
  bundler: "webpack",
  plugins: [],
  changeConfigure: (config) => config,
  config: {
    development: {
      target: "web" as const,
      publicPath: "/",
      entry: "src/index",
      output: { dir: "dist", filename: "[name].js", formats: "umd" as const },
      alias: { "@": "src" },
      externals: [],
      js: { sourcemap: true, minify: false, splitChunks: false },
      devServer: { open: false, proxy: {}, https: false, host: "0.0.0.0", port: 3000 },
    },
    production: {
      target: "web" as const,
      publicPath: "/",
      entry: "src/index",
      output: { dir: "dist", filename: "[name].js", formats: "umd" as const },
      alias: { "@": "src" },
      externals: [],
      js: { sourcemap: false, minify: true, splitChunks: true },
      devServer: { open: false, proxy: {}, https: false, host: "0.0.0.0", port: 3000 },
    },
  } as any as IBuildConfig["config"],
});
