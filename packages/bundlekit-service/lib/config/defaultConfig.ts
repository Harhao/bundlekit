import { IBuildConfig } from "@bundlekit/shared-utils";

/**
 * Service-level 默认配置
 *
 * 注意：这里只保留 development 一份默认值。
 * - 用户只在 .bundlekitrc 写 development 时，bundler 适配器会通过
 *   `config.config?.[mode] || config.config?.development` 兜底使用 development。
 * - 如果这里也预置 production 块，deepMerge 会把它当作"用户已声明 production"，
 *   导致 || development 兜底永远不触发，用户写在 development 里的 entry/pages 等
 *   被默认 production 块（entry:"src/index"）覆盖，build --mode production 必然失败。
 */
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
  },
});
