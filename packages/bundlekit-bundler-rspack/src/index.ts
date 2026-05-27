import path from "path";
import { fileURLToPath } from "url";
import Rspack, { type RspackOptions } from "@rspack/core";
import { RspackDevServer } from "@rspack/dev-server";

import {
    FileManager,
    Logger,
    validateBuildConfig,
    createSSRRequestHandler,
    buildSSRView,
    resolveSSRExternalsForWebpack,
} from "@bundlekit/shared-utils";
import type {
    IBuildConfig,
    IBuildToolAdapter,
    IService,
    IBuildEnv,
    IRequestHandler,
    ISSRMiddlewareCtx,
} from "@bundlekit/shared-utils";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default class RspackBundler implements IBuildToolAdapter<RspackOptions> {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    private fse: FileManager;
    public name: string = "@bundlekit/bundler-rspack";

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

        const cssExtract = rawEnvConfig.css?.extract || false;
        const cssLoader = (extraLoaders: any[] = []) => [
            cssExtract ? Rspack.CssExtractRspackPlugin.loader : "style-loader",
            { loader: "css-loader", options: { modules: rawEnvConfig.css?.modules || false, sourceMap: rawEnvConfig.css?.sourcemap || false } },
            ...extraLoaders,
        ];

        // SSR server pass：target='node' 时输出 commonjs2 / module，并 externalize node_modules
        const isServerPass = rawEnvConfig.target === 'node';
        const outputFormat = rawEnvConfig.output?.formats
            ? (Array.isArray(rawEnvConfig.output.formats) ? rawEnvConfig.output.formats[0] : rawEnvConfig.output.formats)
            : undefined;
        const serverLibraryType = outputFormat === 'esm' ? 'module' : 'commonjs2';
        const libraryConfig = isServerPass
            ? { type: serverLibraryType }
            : (rawEnvConfig.output?.formats ? { type: outputFormat } : undefined);

        const serverExternals = isServerPass ? this.resolveServerExternals(rawEnvConfig) : (rawEnvConfig.externals || []);

        return {
            mode: this.mode === "development" ? "development" : "production",
            entry: resolvedEntry,
            devtool: rawEnvConfig.js?.sourcemap ? "source-map" : false,
            output: {
                path: path.resolve(this.context, outDir),
                filename: rawEnvConfig.output?.filename || "[name].js",
                publicPath: rawEnvConfig.publicPath || "/",
                library: libraryConfig,
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
                        use: cssLoader(),
                        type: "javascript/auto",
                    },
                    ...(rawEnvConfig.css?.loaders?.includes("less") ? [{
                        test: /\.less$/,
                        use: cssLoader(["less-loader"]),
                        type: "javascript/auto",
                    }] : []),
                    ...(rawEnvConfig.css?.loaders?.includes("sass") || rawEnvConfig.css?.loaders?.includes("scss") ? [{
                        test: /\.(scss|sass)$/,
                        use: cssLoader(["sass-loader"]),
                        type: "javascript/auto",
                    }] : []),
                ],
            },
            plugins: [
                new Rspack.DefinePlugin({
                    "process.env.NODE_ENV": JSON.stringify(this.mode),
                }),
                ...(cssExtract ? [new Rspack.CssExtractRspackPlugin({
                    filename: (rawEnvConfig.output?.filename || "[name].css").replace(/\.js$/, ".css"),
                })] : []),
                ...frameworkPlugins,
                ...htmlPlugins,
            ],
            optimization: {
                minimize: rawEnvConfig.js?.minify || false,
                splitChunks: isServerPass ? false : (rawEnvConfig.js?.splitChunks ? { chunks: "all" } : false),
            },
            externals: serverExternals,
            target: rawEnvConfig.target || "web",
            resolveLoader: {
                modules: [
                    path.resolve(__dirname, "../../bundlekit-bundler-webpack/node_modules"),
                    path.resolve(this.context, "node_modules"),
                    "node_modules",
                ],
            },
            ...(isServerPass ? {} : {
                devServer: {
                    hot: true,
                    server: devServerCfg.https ? "https" : "http",
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
            }),
        } as any;
    }

    /**
     * SSR server pass externals — 委托给 shared-utils 统一实现（webpack/rspack callback 格式）
     */
    private resolveServerExternals(rawEnvConfig: any): any {
        return resolveSSRExternalsForWebpack(rawEnvConfig.ssr, this.context);
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
                    // 必须 await 编译完成，否则 Service 的 SSR 双 pass 会变成「fire-and-forget」
                    // → client / server pass 并行跑，且后续依赖 dist 产物的逻辑（如 Service.ts
                    // 的兜底 HTML 注入器）会读到空目录。
                    await new Promise<void>((resolve, reject) => {
                        compiler.run((err: any, stats: any) => {
                            if (err) {
                                this.logger.error(`打包失败, 错误信息: ${err}`);
                                reject(err);
                                return;
                            }
                            if (stats) {
                                process.stdout.write(stats.toString({ colors: true }) + "\n");
                                if (stats.hasErrors?.()) {
                                    reject(new Error("rspack 构建包含错误"));
                                    return;
                                }
                            }
                            compiler.close(() => resolve());
                        });
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

    /**
     * Rspack dev SSR middleware
     *
     * 行为镜像 webpack：dev-server 中间件模式 + ssrHandler
     *
     *   1. 用 RspackDevServer 自身 middleware mode 处理 client 编译 + HMR
     *   2. 单独 watch 一个 server compiler 编译 server bundle 到磁盘
     *   3. ssrHandler 每次请求都清 require cache 并 require 最新 server bundle 调 render
     */
    public async createSSRMiddleware(
        buildConfig: IBuildConfig,
        ctx: ISSRMiddlewareCtx,
    ): Promise<IRequestHandler[]> {
        const envConfig = buildConfig.config?.[this.mode] || buildConfig.config?.development;
        const ssrConfig = (envConfig as any)?.ssr;
        if (!ssrConfig) throw new Error("ssr config not found in envConfig");

        // 1) client config + middleware mode dev server
        const clientConfig = this.transformConfig(buildConfig);
        // rspack dev-server middleware mode + 不绑定端口
        (clientConfig as any).devServer = {
            ...(clientConfig.devServer || {}),
            hot: true,
            historyApiFallback: true,
        };
        const clientCompiler = Rspack(clientConfig as any);
        const devServer = new RspackDevServer(
            {
                ...((clientConfig as any).devServer),
                // middleware-only：rspack-dev-server 没有 middlewareMode，但通过不调 start() 仅取 middleware
            } as any,
            clientCompiler as any,
        );
        // RspackDevServer 暴露的 middleware 链
        // @ts-expect-error - rspack-dev-server middleware API 内部
        const devMiddleware = devServer.app?.callback?.()
            || ((req: any, res: any, next: any) => next());

        // 2) server compiler watch
        const serverBuildConfig = buildSSRView(buildConfig, this.mode);
        const serverConfig = this.transformConfig(serverBuildConfig);
        const serverOutDir = path.resolve(this.context, ssrConfig.output.dir);
        const serverFilename = ssrConfig.output.filename || "server.cjs";
        const serverBundlePath = path.resolve(serverOutDir, serverFilename);

        const serverCompiler = Rspack(serverConfig as any);
        let serverReady = false;
        let pending: Array<() => void> = [];
        const waitUntilReady = () =>
            serverReady ? Promise.resolve() : new Promise<void>((r) => pending.push(r));

        serverCompiler.watch({}, (err: any, stats: any) => {
            if (err) {
                this.logger.error(`server compiler 错误: ${err}`);
                return;
            }
            if (stats?.hasErrors()) {
                this.logger.error(stats.toString({ colors: true, errors: true }));
                return;
            }
            serverReady = true;
            const r = pending; pending = []; r.forEach((f) => f());
        });

        const ssrHandler = createSSRRequestHandler({
            context: this.context,
            ssrConfig,
            serverBundlePath: () => serverBundlePath,
            waitUntilReady,
            onError: (e) => this.logger.error(`SSR 渲染失败: ${e?.message ?? e}`),
            // 与 webpack adapter 镜像：注入 client bundle <script>，让浏览器加载客户端 JS
            // 触发 hydration，否则页面只有 SSR 出来的静态 HTML，事件绑定丢失。
            // 防御：若用户把 ssr.template 指到 prod 编译产物（已含 <script>），就跳过手工注入。
            getTemplate: async (_url) => {
                const fsp = await import("node:fs/promises");
                const templatePath = ssrConfig.template
                    ? path.resolve(this.context, ssrConfig.template)
                    : path.resolve(this.context, "public/index.html");
                let html = await fsp.readFile(templatePath, "utf-8");
                // 模板自带 <script> 标签时直接返回，避免重复加载入口造成双挂载。
                if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
                    return html;
                }
                const publicPath = ((clientConfig as any).output?.publicPath as string) || "/";
                const entryFile = ((clientConfig as any).output as any)?.filename || "[name].js";
                // rspack adapter 把 string entry 包成 { app: entry }，chunk name = 'app'
                const clientUrl = `${publicPath}${entryFile.replace(/\[name\]/g, "app").replace(/\[contenthash[^\]]*\]/g, "")}`;
                const scriptTag = `<script defer src="${clientUrl}"></script>`;
                if (html.includes("</body>")) {
                    html = html.replace(/<\/body>/i, `${scriptTag}</body>`);
                } else {
                    html += scriptTag;
                }
                return html;
            },
        });

        return [devMiddleware as IRequestHandler, ssrHandler];
    }
}
