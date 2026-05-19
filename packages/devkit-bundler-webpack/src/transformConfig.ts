
import os from "os";
import path from "path";
import Webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import TerserPlugin from "terser-webpack-plugin";

import { fileURLToPath } from "url";
import { Logger } from "@devkit/shared-utils";
import type { Configuration } from "webpack";
import type { IBuildConfig, IBuildEnv, IBuildOutput } from "@devkit/shared-utils"

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const defaultAssetRules = [
    {
        test: new RegExp('\\.(png|jpe?g|gif|svg|webp|ico|bmp)$'),
        type: 'asset/resource',
        generator: { filename: "static/media/[hash][ext]" }
    },
    {
        test: new RegExp('\\.(woff|woff2|eot|ttf|otf)$'),
        type: 'asset/resource',
        generator: { filename: "static/font/[hash][ext]" }
    }
];

const defaultPlugins = [
    new Webpack.DefinePlugin({
        "process.env": JSON.stringify({
            NODE_ENV: process.env.NODE_ENV,
        })
    }),
]


export default class TransformConfig {

    private mode: "development" | "production" | "none";
    private context: string;

    private logger: Logger = new Logger();
    private buildConfig: IBuildConfig["config"][IBuildEnv];

    private transformConfig: Partial<Configuration> = {};

    constructor(context: string, config: IBuildConfig["config"][IBuildEnv], buildEnv: IBuildEnv) {

        this.context = context || process.cwd();
        this.buildConfig = config;
        this.mode = buildEnv === "development" ? "development" : "production";
    }

    public startTransformHandle() {

        const entry = this.buildConfig.entry
            ? (typeof this.buildConfig.entry === "string"
                ? { app: this.buildConfig.entry }
                : this.buildConfig.entry)
            : { app: "./src/index.tsx" };

        const resolvedEntry: Record<string, string> = {};
        for (const [key, val] of Object.entries(entry)) {
            resolvedEntry[key] = path.resolve(this.context, val);
        }

        const outDir = (this.buildConfig.output && !Array.isArray(this.buildConfig.output) ? (this.buildConfig.output as IBuildOutput).dir : undefined)
            || (Array.isArray(this.buildConfig.output) ? (this.buildConfig.output as IBuildOutput[])[0]?.dir : undefined)
            || "dist";

        const buildOutput = !Array.isArray(this.buildConfig.output) ? (this.buildConfig.output as IBuildOutput) : undefined;
        const fmt = buildOutput?.formats;
        const primaryFormat = Array.isArray(fmt) ? fmt[0] : (fmt || 'umd');

        this.transformConfig = {
            mode: this.mode || "none",
            cache: false,
            stats: "errors-only",
            entry: resolvedEntry,
            output: {
                path: path.resolve(this.context, outDir),
                filename: buildOutput?.filename || '[name].js',
                publicPath: this.buildConfig.publicPath || '/',
                library: {
                    type: primaryFormat
                }
            },
            resolveLoader: {
                modules: [
                    path.resolve(__dirname, '../node_modules'),
                    'node_modules'
                ]
            },
            externals: this.buildConfig.externals || [],
            // 声明 es2020 让 webpack 自动把内部 TerserPlugin ecma 升到 2020，支持可选链等现代语法
            target: this.buildConfig.target === 'node' ? 'node' : ['web', 'es2020'],
            resolve: this.transformResolve(),
            module: {
                rules: [
                    ...this.transformScriptRules(),
                    ...defaultAssetRules,
                    ...this.transformCssConfig(),
                    ...this.transformFrameworkRules(),
                ]
            },
            ...this.transformPerformance(),
            plugins: [
                ...defaultPlugins,
                ...(this.buildConfig.css?.extract ? [new MiniCssExtractPlugin({ filename: buildOutput?.filename || '[name].css' })] : []),
                ...this.transformPlugins(),
                ...this.transformFrameworkPlugins()
            ]
        };

        if (this.mode === "development") {
            this.transformConfig.devServer = this.transformDevServer();
        }

        return this.transformConfig;
    }

    private transformResolve(): Configuration['resolve'] {
        const framework = (this.buildConfig as any).framework as string;
        const extensions = ['.ts', '.js', '.jsx', '.tsx', '.json'];
        if (framework === 'vue3') extensions.push('.vue');
        return {
            alias: this.buildConfig.alias || {},
            mainFiles: ['index'],
            extensions,
        };
    }

    private transformScriptRules() {
        const framework = (this.buildConfig as any).framework as string;
        // module: esnext 让 webpack 处理 ES 模块；target: ES5 保证输出 ES5 语法，Terser 默认配置可直接压缩
        const tsCompilerOptions: Record<string, any> = { module: 'esnext', target: 'ES5' };
        if (framework === 'react') {
            tsCompilerOptions.jsx = 'react-jsx';
            tsCompilerOptions.jsxImportSource = 'react';
        }
        return [{
            test: new RegExp('\\.(js|jsx|ts|tsx)$'),
            exclude: /node_modules/,
            use: [
                { loader: 'thread-loader', options: { workers: os.cpus().length } },
                { loader: 'ts-loader', options: { happyPackMode: true, compilerOptions: tsCompilerOptions, transpileOnly: true } },
            ],
        }];
    }

    /** Vue 专用 loader */
    private transformFrameworkRules() {
        const framework = (this.buildConfig as any).framework as string;
        if (framework !== 'vue3') return [];
        return [{
            test: /\.vue$/,
            loader: 'vue-loader',
        }];
    }

    /** Vue 专用 plugin（VueLoaderPlugin） */
    private transformFrameworkPlugins(): Webpack.WebpackPluginInstance[] {
        const framework = (this.buildConfig as any).framework as string;
        if (framework !== 'vue3') return [];
        try {
            const { VueLoaderPlugin } = require('vue-loader');
            return [new VueLoaderPlugin()];
        } catch {
            return [];
        }
    }


    private getNetworkIPAdress(devServer) {
        const networkInterfaces = os.networkInterfaces();
        for (const devName in networkInterfaces) {
            const iface = networkInterfaces[devName];
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && !alias.internal) {
                    return alias.address;
                }
            }
        }
        return 'localhost';
    }

    private transformDevServer(): Configuration['devServer'] {

        let fn = this.getNetworkIPAdress;
        let logger = this.logger;

        const rawProxy = this.buildConfig.devServer?.proxy || {};
        const proxyArray = Array.isArray(rawProxy)
            ? rawProxy
            : Object.entries(rawProxy).map(([context, opts]: [string, any]) => ({
                context: [context],
                target: opts.target ?? opts,
                changeOrigin: opts.changeOrigin ?? true,
                secure: opts.secure ?? false,
            }));

        return {
            historyApiFallback: true,
            hot: true,
            host: this.buildConfig.devServer?.host || '0.0.0.0',
            port: this.buildConfig.devServer?.port || 3000,
            open: this.buildConfig.devServer?.open ?? true,
            server: this.buildConfig.devServer?.https ? 'https' : 'http',
            compress: true,
            proxy: proxyArray,
            client: {
                overlay: true,
                logging: 'none'
            },
            onListening: function (devServer: any) {
                const addresses = devServer.server.address();
                const port = addresses?.port;

                logger.clearConsole("启动监听服务:");
                logger.done(`服务已启动:`, '🌐');
                logger.log(`- 本地: http://localhost:${port}`);
                logger.log(`- 网络: http://${fn(devServer)}:${port}`);
            }
        };
    }

    private transformPerformance() {

        if (!this.buildConfig.js) return {};

        const config: Partial<Configuration> = {
            devtool: this.buildConfig.js.sourcemap ? 'hidden-source-map' : false
        };

        if (this.buildConfig.js.minify || this.buildConfig.js.splitChunks) {
            config.optimization = {
                ...config.optimization,
                minimize: this.buildConfig.js.minify,
                minimizer: this.buildConfig.js.minify ? [
                    new TerserPlugin({
                        parallel: false,
                        terserOptions: {
                            parse: { ecma: 2020 },
                            compress: { ecma: 2020, drop_console: true },
                            output: { ecma: 2020 },
                        } as any,
                    }),
                ] : undefined,
                splitChunks: this.buildConfig.js.splitChunks ? {
                    chunks: 'all',
                    cacheGroups: {
                        vendors: {
                            test: /[\\/]node_modules[\\/]/,
                            priority: -10,
                            reuseExistingChunk: true
                        },
                        default: {
                            minChunks: 2,
                            priority: -20,
                            reuseExistingChunk: true
                        }
                    }
                } : undefined
            };
        }

        return config;
    }

    private transformCssConfig() {

        if (!this.buildConfig.css) return [];

        const cssLoaders: any[] = [
            {
                loader: 'css-loader',
                options: {
                    modules: this.buildConfig.css.modules,
                    sourceMap: this.buildConfig.css.sourcemap
                }
            }
        ];

        if (this.buildConfig.css.loaders?.includes('less')) {
            cssLoaders.push({
                loader: 'less-loader',
                options: { sourceMap: this.buildConfig.css.sourcemap }
            });
        }

        if (this.buildConfig.css.loaders?.includes('sass') || this.buildConfig.css.loaders?.includes('scss')) {
            cssLoaders.push({
                loader: 'sass-loader',
                options: { sourceMap: this.buildConfig.css.sourcemap }
            });
        }

        if (this.buildConfig.css.extract) {
            cssLoaders.unshift({ loader: MiniCssExtractPlugin.loader });
        } else {
            cssLoaders.unshift({ loader: 'style-loader' });
        }

        const testReg = this.buildConfig.css.loaders?.includes('sass') || this.buildConfig.css.loaders?.includes('scss')
            ? /\.(css|less|scss|sass)$/
            : /\.(css|less)$/;

        return [{ test: testReg, use: cssLoaders }];
    }

    private transformOutput(output: IBuildOutput | IBuildOutput[]) {

        // const transformSingleOutput = (item: IBuildOutput) => ({
        //     path: item.dir,
        //     filename: item.filename,
        //     library: {
        //         type: item.formats
        //     }
        // });

        // return Array.isArray(output)
        //     ? output.map(transformSingleOutput)
        //     : transformSingleOutput(output);
    }

    private transformPlugins() {
        const pages = this.buildConfig.pages || [];
        return pages.map((page) =>
            new HtmlWebpackPlugin({
                template: path.resolve(this.context, page.template),
                filename: page.filename,
                inject: page.inject || "body",
            })
        );
    }
}