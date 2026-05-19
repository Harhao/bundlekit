import path from "path";
import Rspack, { type RspackOptions } from "@rspack/core";
import { RspackDevServer } from "@rspack/dev-server";

import { FileManager, Logger, validateBuildConfig } from "@devkit/shared-utils";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv } from "@devkit/shared-utils";

export default class RspackBundler implements IBuildToolAdapter<RspackOptions> {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    private fse: FileManager;
    public name: string = "@devkit/bundler-rspack";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode = mode;
        this.context = api.context || process.cwd();
        this.fse = new FileManager(this.context);
    }

    public transformConfig(config: IBuildConfig): RspackOptions {
        const rawEnvConfig = (config.config?.[this.mode] || config.config?.development || {}) as Record<string, any>;

        const entry = rawEnvConfig.entry
            ? (typeof rawEnvConfig.entry === "string" ? { app: rawEnvConfig.entry } : rawEnvConfig.entry)
            : { app: path.resolve(this.context, "src/index.ts") };

        const resolvedEntry: Record<string, string> = {};
        for (const [key, val] of Object.entries(entry)) {
            resolvedEntry[key] = path.resolve(this.context, String(val));
        }

        const outDir = (rawEnvConfig.output && !Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output.dir : undefined)
            || (Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output[0]?.dir : undefined)
            || "dist";

        const alias = rawEnvConfig.alias || {};
        const devServerCfg = rawEnvConfig.devServer || {};
        const pages = rawEnvConfig.pages || [];
        const framework = rawEnvConfig.framework as string | undefined;

        const extensions = [".ts", ".tsx", ".js", ".jsx", ".json"];
        if (framework === "vue3") extensions.push(".vue");

        const swcOptions: any = {
            jsc: {
                parser: { syntax: "typescript", tsx: framework === "react" || framework === "vue3" },
                ...(framework === "react" ? {
                    transform: { react: { runtime: "automatic" } },
                } : {}),
            },
        };

        const frameworkRules: any[] = framework === "vue3" ? [{
            test: /\.vue$/,
            loader: "vue-loader",
            type: "javascript/auto",
        }] : [];

        const frameworkPlugins: any[] = framework === "vue3" ? (() => {
            try {
                const { VueLoaderPlugin } = require("vue-loader");
                return [new VueLoaderPlugin()];
            } catch { return []; }
        })() : [];

        const htmlPlugins = pages.map((page: any) =>
            new Rspack.HtmlRspackPlugin({
                template: path.resolve(this.context, page.template),
                filename: page.filename,
                inject: page.inject || "body",
            })
        );

        return {
            mode: this.mode === "development" ? "development" : "production",
            entry: resolvedEntry,
            devtool: rawEnvConfig.js?.sourcemap ? "source-map" : false,
            output: {
                path: path.resolve(this.context, outDir),
                filename: rawEnvConfig.output?.filename || "[name].js",
                publicPath: rawEnvConfig.publicPath || "/",
                library: rawEnvConfig.output?.formats ? {
                    type: Array.isArray(rawEnvConfig.output.formats) ? rawEnvConfig.output.formats[0] : rawEnvConfig.output.formats,
                } : undefined,
            },
            resolve: {
                extensions,
                alias: Object.entries(alias).reduce((acc, [key, val]) => {
                    acc[key] = path.resolve(this.context, String(val));
                    return acc;
                }, {} as Record<string, string>),
            },
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        use: [{ loader: "builtin:swc-loader", options: swcOptions }],
                        type: "javascript/auto",
                    },
                    ...frameworkRules,
                    {
                        test: /\.(png|jpe?g|gif|svg|webp|ico|bmp)$/,
                        type: "asset",
                        generator: { filename: "static/images/[hash][ext]" },
                    },
                    {
                        test: /\.(woff|woff2|eot|ttf|otf)$/,
                        type: "asset",
                        generator: { filename: "static/fonts/[hash][ext]" },
                    },
                    {
                        test: /\.css$/,
                        use: ["style-loader", { loader: "css-loader", options: { modules: rawEnvConfig.css?.modules || false, sourceMap: rawEnvConfig.css?.sourcemap || false } }],
                        type: "javascript/auto",
                    },
                    ...(rawEnvConfig.css?.loaders?.includes("less") ? [{
                        test: /\.less$/,
                        use: ["style-loader", { loader: "css-loader", options: { modules: rawEnvConfig.css?.modules || false, sourceMap: rawEnvConfig.css?.sourcemap || false } }, "less-loader"],
                        type: "javascript/auto",
                    }] : []),
                    ...(rawEnvConfig.css?.loaders?.includes("sass") || rawEnvConfig.css?.loaders?.includes("scss") ? [{
                        test: /\.(scss|sass)$/,
                        use: ["style-loader", { loader: "css-loader", options: { modules: rawEnvConfig.css?.modules || false, sourceMap: rawEnvConfig.css?.sourcemap || false } }, "sass-loader"],
                        type: "javascript/auto",
                    }] : []),
                ],
            },
            plugins: [
                new Rspack.DefinePlugin({
                    "process.env.NODE_ENV": JSON.stringify(this.mode),
                }),
                ...frameworkPlugins,
                ...htmlPlugins,
            ],
            optimization: {
                minimize: rawEnvConfig.js?.minify || false,
                splitChunks: rawEnvConfig.js?.splitChunks ? { chunks: "all" } : false,
            },
            externals: rawEnvConfig.externals || [],
            target: rawEnvConfig.target || "web",
            devServer: {
                hot: true,
                https: devServerCfg.https || false,
                historyApiFallback: true,
                open: devServerCfg.open !== undefined ? devServerCfg.open : true,
                host: devServerCfg.host || "0.0.0.0",
                port: devServerCfg.port || 3000,
                proxy: Array.isArray(devServerCfg.proxy)
                    ? devServerCfg.proxy
                    : Object.keys(devServerCfg.proxy || {}).length > 0
                        ? Object.entries(devServerCfg.proxy).map(([context, target]) => ({
                            context,
                            target: typeof target === "object" ? (target as any).target : target,
                            changeOrigin: true,
                        }))
                        : [],
            },
        } as any;
    }

    public validateConfig(config: RspackOptions, buildConfig?: IBuildConfig) {
        if (buildConfig) return validateBuildConfig(buildConfig, this.mode).valid;
        return true;
    }

    public async run(config: RspackOptions) {
        try {
            this.logger.info(`开始使用rspack进行打包`);
            switch (this.mode) {
                case "development": {
                    const compiler = Rspack(config as any);
                    const server = new RspackDevServer(config.devServer as any || {
                        hot: true,
                        port: 3000,
                    }, compiler);
                    await server.start();
                    break;
                }
                case "production":
                case "test":
                case "staging":
                case "gray": {
                    const compiler = Rspack(config as any);
                    compiler.run((err: any, stats: any) => {
                        if (err) {
                            this.logger.error(`打包失败, 错误信息: ${err}`);
                            process.exit(1);
                        }
                        if (stats) {
                            process.stdout.write(stats.toString({ colors: true }) + "\n");
                        }
                        compiler.close(() => {});
                    });
                    break;
                }
                default:
                    break;
            }
        } catch (e) {
            this.logger.error(`打包失败, 错误信息: ${e}`);
            throw e;
        }
    }
}
