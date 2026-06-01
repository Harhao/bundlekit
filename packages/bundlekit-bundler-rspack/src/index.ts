import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
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
const _require = createRequire(import.meta.url);

/**
 * 从字符串 entry 派生 chunk 名（去目录、去扩展名）。
 *
 *   - "src/index.ts"           → "index"
 *   - "./src/entry-server.tsx" → "entry-server"
 *   - "src/main.js"            → "main"
 *
 * 旧实现一律使用 "app"，导致 [name].js 输出与 package.json 主入口字段不一致
 * （如 node-ts 模板声明 ./dist/index.js 却实际产出 ./dist/app.js）。
 */
function deriveChunkName(entry: string): string {
    const base = path.basename(entry, path.extname(entry));
    return base || "app";
}

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
            ? (typeof rawEnvConfig.entry === "string" ? { [deriveChunkName(rawEnvConfig.entry)]: rawEnvConfig.entry } : rawEnvConfig.entry)
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
        if (framework === "svelte") extensions.push(".svelte");

        const swcOptions: any = {
            jsc: {
                parser: { syntax: "typescript", tsx: framework === "react" || framework === "vue3" },
                ...(framework === "react" ? {
                    transform: { react: { runtime: "automatic" } },
                } : {}),
            },
        };

        const frameworkRules: any[] = framework === "vue3" ? (() => {
            try {
                _require.resolve("vue-loader");
                return [{
                    test: /\.vue$/,
                    loader: "vue-loader",
                    type: "javascript/auto",
                }];
            } catch { return []; }
        })() : framework === "svelte" ? (() => {
            try {
                _require.resolve("svelte-loader");
                const isServerPassLocal = rawEnvConfig.__isServerPass === true;
                const enableHydratable = !!rawEnvConfig.ssr;
                // svelte-preprocess：让 .svelte 内部 <script lang="ts"> 被处理
                let preprocess: any = undefined;
                try {
                    const preprocessFactory = _require("svelte-preprocess");
                    const factory = preprocessFactory.default || preprocessFactory;
                    preprocess = typeof factory === "function" ? factory() : factory;
                } catch {
                    /* svelte-preprocess 缺失时只跳过 lang="ts" 处理，纯 JS 仍可工作 */
                }
                return [
                    {
                        test: /\.svelte$/,
                        use: [{
                            loader: "svelte-loader",
                            options: {
                                compilerOptions: {
                                    generate: isServerPassLocal ? "ssr" : "dom",
                                    hydratable: enableHydratable,
                                },
                                ...(preprocess ? { preprocess } : {}),
                                emitCss: false,
                            },
                        }],
                        type: "javascript/auto",
                    },
                    {
                        // svelte 内部 .mjs/.js 模块需要禁用 fullySpecified
                        test: /node_modules[\\/]svelte[\\/].*\.m?js$/,
                        resolve: { fullySpecified: false },
                    },
                ];
            } catch { return []; }
        })() : [];

        const frameworkPlugins: any[] = framework === "vue3" ? (() => {
            try {
                const { VueLoaderPlugin } = _require("vue-loader");
                return [new VueLoaderPlugin()];
            } catch { return []; }
        })() : [];

        const htmlPlugins = (rawEnvConfig.library === true ? [] : pages).map((page: any) =>
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

        // SSR server pass：仅在 buildSSRView 注入 __isServerPass=true 时启用 SSR
        // 专属逻辑（commonjs2/module 输出、server externals 等）。单纯
        // target=node（node-ts 库模板）不再被误判为 SSR pass。
        const isServerPass = rawEnvConfig.__isServerPass === true;
        const outputFormat = rawEnvConfig.output?.formats
            ? (Array.isArray(rawEnvConfig.output.formats) ? rawEnvConfig.output.formats[0] : rawEnvConfig.output.formats)
            : undefined;
        const serverLibraryType = outputFormat === 'esm' ? 'module' : 'commonjs2';

        // Library 模式：library=true 走 library 输出，libraryName 填到 output.library.name
        //   - 跳过 HtmlRspackPlugin（上面已处理）
        //   - format → rspack library type 标准化映射
        const isLibrary = rawEnvConfig.library === true;
        const libraryName = rawEnvConfig.libraryName as string | undefined;
        const formatToLibType = (f: string | undefined): string => {
            switch (f) {
                case 'esm':      return 'module';
                case 'commonjs': return 'commonjs2';
                case 'umd':      return 'umd';
                case 'iife':     return 'window';
                default:         return f || 'umd';
            }
        };
        const clientLibType = formatToLibType(outputFormat);
        const libraryConfig: any = isServerPass
            ? { type: serverLibraryType }
            : isLibrary
                ? {
                    type: clientLibType,
                    ...(libraryName || ['umd', 'window', 'amd'].includes(clientLibType)
                        ? { name: libraryName || Object.keys(resolvedEntry)[0] || 'app' }
                        : {}),
                    ...(clientLibType === 'umd' ? { umdNamedDefine: true } : {}),
                }
                // 应用模式：rspack 默认 IIFE wrapping 即可，不下发 library，
                // 避免把模板里的 output.formats（如 'esm'）误塞进 library.type 报错
                : undefined;

        const serverExternals = isServerPass ? this.resolveServerExternals(rawEnvConfig) : (rawEnvConfig.externals || []);

        return {
            mode: this.mode === "development" ? "development" : "production",
            entry: resolvedEntry,
            devtool: rawEnvConfig.js?.sourcemap ? "source-map" : false,
            output: {
                path: path.resolve(this.context, outDir),
                filename: rawEnvConfig.output?.filename || "[name].js",
                publicPath: rawEnvConfig.publicPath || "/",
                ...(libraryConfig ? { library: libraryConfig } : {}),
                ...(isLibrary && libraryConfig?.type === 'umd'
                    ? { globalObject: 'typeof self !== "undefined" ? self : this' }
                    : {}),
            },
            // ESM 输出需要开 experiments.outputModule
            ...((libraryConfig?.type === 'module')
                ? { experiments: { outputModule: true } }
                : {}),
            resolve: {
                extensions,
                alias: Object.entries(alias).reduce((acc, [key, val]) => {
                    acc[key] = path.resolve(this.context, String(val));
                    return acc;
                }, {} as Record<string, string>),
                ...(framework === "svelte"
                    ? {
                        mainFields: ["svelte", "browser", "module", "main"],
                        conditionNames: ["svelte", "browser", "import", "require"],
                    }
                    : {}),
            },
            module: {
                rules: [
                    {
                        // 同时匹配 .ts/.tsx/.js/.jsx —— SWC 的 typescript parser
                        // 是 ecmascript 的超集，能正确处理 JSX（启用 tsx 时）
                        test: /\.[jt]sx?$/,
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

        // 动态加载 dev / hot middleware（与 webpack adapter 对齐：rspack 编译器
        // 实现了 webpack 兼容 API，可直接用 webpack-dev-middleware / -hot-middleware）。
        // 之前依赖 RspackDevServer.app.callback() 的 hack 在不调 .start() 时
        // 资源服务（/entry-client.js 等）链路并未完全装配，导致请求 hang。
        const { default: webpackDevMiddleware } = await import("webpack-dev-middleware");
        const { default: webpackHotMiddleware } = await import("webpack-hot-middleware");

        // 1) client config + HMR 入口注入
        const clientConfig = this.transformConfig(buildConfig);
        let hotClientPath: string;
        try {
            hotClientPath = _require.resolve("webpack-hot-middleware/client");
        } catch {
            hotClientPath = "webpack-hot-middleware/client";
        }
        const hotEntry = `${hotClientPath}?path=/__webpack_hmr`;
        const origEntry = (clientConfig as any).entry;
        (clientConfig as any).entry = Array.isArray(origEntry)
            ? [hotEntry, ...origEntry]
            : typeof origEntry === "string"
                ? [hotEntry, origEntry]
                : (() => {
                    const next: Record<string, any> = {};
                    for (const k of Object.keys(origEntry || {})) {
                        const v = origEntry[k];
                        next[k] = Array.isArray(v) ? [hotEntry, ...v] : [hotEntry, v];
                    }
                    return next;
                })();
        (clientConfig as any).plugins = [
            ...((clientConfig as any).plugins || []),
            new Rspack.HotModuleReplacementPlugin(),
        ];

        const clientCompiler = Rspack(clientConfig as any);
        const devMiddleware = webpackDevMiddleware(clientCompiler as any, {
            publicPath: ((clientConfig as any).output?.publicPath as string) || "/",
            stats: "errors-warnings",
        });
        const hotMiddleware = webpackHotMiddleware(clientCompiler as any, {
            log: false,
            path: "/__webpack_hmr",
        });

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
            getTemplate: async (_url) => {
                const fsp = await import("node:fs/promises");
                const templatePath = ssrConfig.template
                    ? path.resolve(this.context, ssrConfig.template)
                    : path.resolve(this.context, "public/index.html");
                let html = await fsp.readFile(templatePath, "utf-8");
                if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
                    return html;
                }
                const publicPath = ((clientConfig as any).output?.publicPath as string) || "/";
                const entryFile = ((clientConfig as any).output as any)?.filename || "[name].js";
                const clientEntry = (clientConfig as any).entry as Record<string, string> | undefined;
                const chunkName = clientEntry && !Array.isArray(clientEntry)
                    ? Object.keys(clientEntry).find((k) => k !== "0") || "app"
                    : "app";
                const clientUrl = `${publicPath}${entryFile.replace(/\[name\]/g, chunkName).replace(/\[contenthash[^\]]*\]/g, "")}`;
                const scriptTag = `<script defer src="${clientUrl}"></script>`;
                if (html.includes("</body>")) {
                    html = html.replace(/<\/body>/i, `${scriptTag}</body>`);
                } else {
                    html += scriptTag;
                }
                return html;
            },
        });

        return [makeSSRPageRouter(ssrHandler), devMiddleware as IRequestHandler, hotMiddleware as IRequestHandler];
    }
}

/**
 * 把 SSR handler 包成 connect 风格 middleware：
 *
 *   - 仅处理 page 请求（path 无文件扩展名 或 .html）→ 调 ssrHandler
 *   - 资源请求（.js / .css / .png / chunk hash 等）→ next() 让 dev-middleware 服务
 *
 * 与 webpack adapter 的 `makeSSRPageRouter` 行为一致。必须放在 dev-middleware
 * 前面，否则 history-api-fallback 会把 /entry-client.js 错误回退成 HTML 文档。
 */
function makeSSRPageRouter(ssrHandler: IRequestHandler): IRequestHandler {
    return (req, res, next) => {
        const url = req.url || "/";
        const cleaned = url.split("?")[0].split("#")[0];
        const m = /\.([a-z0-9]+)$/i.exec(cleaned);
        const isAsset = !!m && m[1].toLowerCase() !== "html" && m[1].toLowerCase() !== "htm";
        if (cleaned === "/__webpack_hmr") return next();
        if (isAsset) return next();
        return ssrHandler(req, res, next);
    };
}
