
import os from "os";
import path from "path";
import Webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import TerserPlugin from "terser-webpack-plugin";

import { fileURLToPath } from "url";
import { createRequire } from "module";
import { Logger } from "@bundlekit/shared-utils";
import { resolveSSRExternalsForWebpack } from "@bundlekit/shared-utils";
import type { Configuration } from "webpack";
import type { IBuildConfig, IBuildEnv, IBuildOutput } from "@bundlekit/shared-utils"

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const _require = createRequire(import.meta.url);

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

/**
 * 从字符串 entry 派生 webpack chunk 名（去除目录与扩展名）。
 *
 *   - "src/index.ts"          → "index"
 *   - "./src/entry-server.tsx" → "entry-server"
 *   - "src/main.js"           → "main"
 *
 * 旧实现一律使用 "app"，导致 [name].js 输出与 package.json 中 ./dist/index.js
 * 主入口字段不一致（node-ts 模板）。
 */
function deriveChunkName(entry: string): string {
    const base = path.basename(entry, path.extname(entry));
    return base || "app";
}

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
                ? { [deriveChunkName(this.buildConfig.entry)]: this.buildConfig.entry }
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

        // SSR server pass：仅在 buildSSRView 注入 __isServerPass=true 时启用
        // SSR 专属逻辑（commonjs2 输出、server externals 等）。单纯 target=node
        // （node-ts 库模板）不再被误判为 SSR pass。
        // target=node 的 webpack runtime（resolve、target 字段）仍按 target 判断。
        const isServerPass = (this.buildConfig as any).__isServerPass === true;

        // Library 模式：从 envConfig 读 library / libraryName。
        //   - library=true 时跳过 HtmlWebpackPlugin（不产 dev shell HTML）
        //   - libraryName 填到 output.library.name；UMD/IIFE 不能没有 name，需要 fallback 到入口名
        //   - format 标准化映射：esm → 'module'；commonjs → 'commonjs2'；umd / iife / amd 透传
        const isLibrary = (this.buildConfig as any).library === true;
        const libraryName = (this.buildConfig as any).libraryName as string | undefined;
        const formatToLibType = (f: string): string => {
            switch (f) {
                case 'esm':      return 'module';
                case 'commonjs': return 'commonjs2';
                case 'umd':      return 'umd';
                case 'iife':     return 'window';
                default:         return f;
            }
        };
        const serverFormat = primaryFormat === 'esm' ? 'module' : 'commonjs2';
        // 应用模式（非 library、非 SSR server pass）：不下发 library 字段
        //   - webpack 默认 IIFE chunk wrapping 即正确的浏览器 bundle 形态
        //   - 模板的 output.formats 仅对 library / SSR 有语义，应用模式忽略
        //   - 之前直接把 formats 透传到 library.type 会导致 'esm' 报
        //     "Unsupported library type esm"，'umd' 缺 name 报错
        const libraryConfig: any = isServerPass
            ? { type: serverFormat }
            : isLibrary
                ? {
                    type: formatToLibType(String(primaryFormat)),
                    // UMD/window 必须有 name；esm/commonjs2 可空
                    ...(libraryName || (['umd', 'window', 'amd'].includes(formatToLibType(String(primaryFormat)))) ? {
                        name: libraryName || Object.keys(resolvedEntry)[0] || 'app',
                    } : {}),
                    ...(formatToLibType(String(primaryFormat)) === 'umd' ? { umdNamedDefine: true } : {}),
                }
                : undefined;

        this.transformConfig = {
            mode: this.mode || "none",
            cache: false,
            stats: "errors-only",
            entry: resolvedEntry,
            output: {
                path: path.resolve(this.context, outDir),
                filename: buildOutput?.filename || '[name].js',
                publicPath: this.buildConfig.publicPath || '/',
                ...(libraryConfig ? { library: libraryConfig } : {}),
                ...(isLibrary && libraryConfig?.type === 'umd'
                    ? { globalObject: 'typeof self !== "undefined" ? self : this' }
                    : {}),
            },
            // ESM 输出（library 或 SSR module）需要开 experiments.outputModule
            ...((libraryConfig?.type === 'module')
                ? { experiments: { outputModule: true } }
                : {}),
            resolveLoader: {
                modules: [
                    path.resolve(__dirname, '../node_modules'),
                    'node_modules'
                ]
            },
            externals: isServerPass ? this.resolveServerExternals() : (this.buildConfig.externals || []),
            // server pass 强制 target=node；client pass 兼容 ES5
            target: this.buildConfig.target === 'node' ? 'node' : 'web',
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
                ...(this.buildConfig.css?.extract ? [new MiniCssExtractPlugin({
                    // CSS 文件名必须用 .css 后缀，不能复用 JS 的 filename 模板
                    filename: (buildOutput?.filename || '[name].js').replace(/\.js$/, '.css'),
                })] : []),
                ...this.transformPlugins(),
                ...this.transformFrameworkPlugins()
            ]
        };

        if (this.mode === "development" && !isServerPass) {
            this.transformConfig.devServer = this.transformDevServer();
        }

        return this.transformConfig;
    }
    /**
     * SSR server pass externals — 委托给 shared-utils 统一实现（webpack callback 格式）
     */
    private resolveServerExternals(): any {
        return resolveSSRExternalsForWebpack((this.buildConfig as any).ssr, this.context);
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
                { loader: 'ts-loader', options: { happyPackMode: true, compilerOptions: tsCompilerOptions, transpileOnly: true } },
            ],
        }];
    }

    /** Vue 专用 loader */
    private transformFrameworkRules() {
        const framework = (this.buildConfig as any).framework as string;
        if (framework !== 'vue3') return [];
        try {
            _require.resolve('vue-loader');
            return [{
                test: /\.vue$/,
                loader: 'vue-loader',
            }];
        } catch {
            this.logger.warn('framework 为 vue3 但未找到 vue-loader，跳过 .vue 文件处理规则');
            return [];
        }
    }

    /** Vue 专用 plugin（VueLoaderPlugin） */
    private transformFrameworkPlugins(): Webpack.WebpackPluginInstance[] {
        const framework = (this.buildConfig as any).framework as string;
        if (framework !== 'vue3') return [];
        try {
            const { VueLoaderPlugin } = _require('vue-loader');
            return [new VueLoaderPlugin()];
        } catch {
            this.logger.warn('framework 为 vue3 但未找到 vue-loader，跳过 VueLoaderPlugin');
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
        // 与 rspack 适配器对齐：始终下发 css 基础 loader
        //   - Vue 的 <style scoped> 经 vue-loader 改写为虚拟 .css 模块，必须有规则匹配
        //   - 用户没显式配 css 时，使用 style-loader + css-loader 默认值
        const userCss = this.buildConfig.css || {};

        const cssLoaders: any[] = [
            {
                loader: 'css-loader',
                options: {
                    modules: userCss.modules,
                    sourceMap: userCss.sourcemap
                }
            }
        ];

        if (userCss.loaders?.includes('less')) {
            cssLoaders.push({
                loader: 'less-loader',
                options: { sourceMap: userCss.sourcemap }
            });
        }

        if (userCss.loaders?.includes('sass') || userCss.loaders?.includes('scss')) {
            cssLoaders.push({
                loader: 'sass-loader',
                options: { sourceMap: userCss.sourcemap }
            });
        }

        if (userCss.extract) {
            cssLoaders.unshift({ loader: MiniCssExtractPlugin.loader });
        } else {
            cssLoaders.unshift({ loader: 'style-loader' });
        }

        const testReg = userCss.loaders?.includes('sass') || userCss.loaders?.includes('scss')
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
        // Library 模式：跳过 HTML 注入（用户在打 SDK，没有 HTML 入口）
        if ((this.buildConfig as any).library === true) {
            return [];
        }
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