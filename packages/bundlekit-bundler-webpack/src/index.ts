import path from "path";
import TransformConfig from "./transformConfig";
import Webpack, { Configuration } from "webpack";
import WebpackDevServer from "webpack-dev-server";

import {
    Logger,
    validateBuildConfig,
    createSSRRequestHandler,
    buildSSRView,
} from "@bundlekit/shared-utils";
import type {
    IBuildConfig,
    IBuildToolAdapter,
    IService,
    IBuildEnv,
    IRequestHandler,
    ISSRMiddlewareCtx,
} from "@bundlekit/shared-utils";

export default class WebpackBundler implements IBuildToolAdapter<Configuration> {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    private buildConfig: IBuildConfig | null = null;
    public name: string = "@bundlekit/bundler-webpack";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode = mode;
        this.context = api?.context || process.cwd();
    }

    /**
     * 把抽象层config配置转换成实际bundler支持的webpack配置
     * @param config IBuildConfig 抽象层config配置
     * @returns Configuration webpack配置
     */
    public  getFormatWebpackConfg(config: IBuildConfig = {} as IBuildConfig) {

        const envConfig = config.config?.[this.mode] || config.config?.development || {};

        let transformConfig = new TransformConfig(this.context, envConfig as any, this.mode);

        return  transformConfig.startTransformHandle();
    }

    /**
     * 转换bundler配置处理成webpack配置
     * @param config IBuildConfig 抽象层config配置
     * @returns Configuration webpack配置
     */
    public transformConfig(config: IBuildConfig) {
        this.buildConfig = config;
        this.logger.info(`开始转换webpack配置`);
        const webpackConfig = this.getFormatWebpackConfg(config);
        return webpackConfig;
    }

    /**
     * 校验webpack配置是否合法
     * @param config Configuration webpack配置
     * @returns boolean
     */
    public validateConfig(config: Configuration, buildConfig?: IBuildConfig) {
        if (buildConfig) return validateBuildConfig(buildConfig, this.mode).valid;
        return true;
    };

    /**
     * 运行webpack进行开发构建
     * @param config Configuration webpack配置
     * @returns Promise<void>
     */
    private async devBuild(config: Configuration) {
        try {
            const compiler = Webpack(config);
            const devServerOptions = config.devServer;
            const server = new WebpackDevServer(devServerOptions, compiler);
            await server.start(); // 启动开发服务器
        } catch (e) {
            this.logger.error(`启动开发服务器失败, 错误信息: ${e}`);
            throw e;
        }
    }

    private async prodBuild(config: Configuration): Promise<void> {
        return new Promise((resolve, reject) => {
            Webpack(config, (err, stats) => {
                if (err) {
                    this.logger.error(`打包失败, 错误信息: ${err}`);
                    reject(err);
                    return;
                }
                process.stdout.write(
                    stats.toString({
                        colors: true,
                        modules: false,
                        chunks: false,
                        chunkModules: false
                    }) + "\n\n"
                );
                if (stats.hasErrors()) {
                    const buildError = new Error('webpack 构建包含错误');
                    this.logger.error(`打包失败`);
                    reject(buildError);
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * 运行webpack进行打包构建
     * @param config Configuration webpack配置
     * @returns Promise<void>
     */
    public async run(config: Configuration) {
        try {
            this.logger.info(`开始使用webpack进行打包`);
            this.validateConfig(config, this.buildConfig);
            switch (this.mode) {
                case "development": await this.devBuild(config); break;
                case "production":
                case "test":
                case "staging":
                case "gray": await this.prodBuild(config); break;
                default: await this.prodBuild(config); break;
            }
        } catch (e) {
            this.logger.error(`打包失败, 错误信息: ${e}`);
            throw e;
        }
    }

    /**
     * Webpack dev SSR middleware
     *
     * 实现思路：
     *   1. 用 webpack-dev-middleware + webpack-hot-middleware 处理 client 编译 + HMR
     *   2. 单独起一个 watch compiler 编译 server bundle 到磁盘
     *   3. ssrHandler 每次请求都清 require cache 并 require 最新 server bundle 调 render
     *
     * 注意：server compiler 不参与 HMR，进程级失效；client HMR 通过 hot-middleware 注入。
     */
    public async createSSRMiddleware(
        buildConfig: IBuildConfig,
        ctx: ISSRMiddlewareCtx,
    ): Promise<IRequestHandler[]> {
        // 动态加载 dev / hot middleware（声明在 deps 但避免顶层 import 影响 build 路径）
        const { default: webpackDevMiddleware } = await import("webpack-dev-middleware");
        const { default: webpackHotMiddleware } = await import("webpack-hot-middleware");

        const envConfig = buildConfig.config?.[this.mode] || buildConfig.config?.development;
        const ssrConfig = (envConfig as any)?.ssr;
        if (!ssrConfig) throw new Error("ssr config not found in envConfig");

        // 1) client config：注入 HMR entry + plugin
        const clientConfig = (await this.transformConfig(buildConfig)) as Configuration;
        clientConfig.mode = "development";
        // 解析 webpack-hot-middleware/client 绝对路径，避免 fixture 没装它时 webpack 解析失败
        let hotClientPath: string;
        try {
            hotClientPath = require.resolve("webpack-hot-middleware/client");
        } catch {
            // 兜底：让 webpack 按字符串解析（要求项目自身装了 webpack-hot-middleware）
            hotClientPath = "webpack-hot-middleware/client";
        }
        const hotEntry = `${hotClientPath}?path=/__webpack_hmr`;
        const origEntry = clientConfig.entry as any;
        clientConfig.entry = Array.isArray(origEntry)
            ? [hotEntry, ...origEntry]
            : typeof origEntry === "string"
                ? [hotEntry, origEntry]
                : (() => {
                    // 对象 entry 时给每个 key 注入 hot 入口
                    const next: Record<string, any> = {};
                    for (const k of Object.keys(origEntry || {})) {
                        const v = origEntry[k];
                        next[k] = Array.isArray(v) ? [hotEntry, ...v] : [hotEntry, v];
                    }
                    return next;
                })();
        clientConfig.plugins = [
            ...(clientConfig.plugins || []),
            new Webpack.HotModuleReplacementPlugin(),
        ];

        const clientCompiler = Webpack(clientConfig);
        const devMiddleware = webpackDevMiddleware(clientCompiler as any, {
            publicPath: (clientConfig.output?.publicPath as string) || "/",
            stats: "errors-warnings",
        });
        const hotMiddleware = webpackHotMiddleware(clientCompiler as any, {
            log: false,
            path: "/__webpack_hmr",
        });

        // 2) server config：buildSSRView 切换 entry/output/target
        const serverBuildConfig = buildSSRView(buildConfig, this.mode);
        const serverConfig = (await this.transformConfig(serverBuildConfig)) as Configuration;
        serverConfig.mode = "development";

        const serverOutDir = path.resolve(this.context, ssrConfig.output.dir);
        const serverFilename = ssrConfig.output.filename || "server.cjs";
        const serverBundlePath = path.resolve(serverOutDir, serverFilename);

        // server compiler 用 watch 模式输出到磁盘；不接 dev-middleware
        const serverCompiler = Webpack(serverConfig);

        let serverReady = false;
        let pendingResolvers: Array<() => void> = [];
        const waitUntilReady = (): Promise<void> =>
            serverReady
                ? Promise.resolve()
                : new Promise<void>((r) => pendingResolvers.push(r));

        serverCompiler.watch({}, (err, stats) => {
            if (err) {
                this.logger.error(`server compiler 错误: ${err}`);
                return;
            }
            if (stats?.hasErrors()) {
                this.logger.error(stats.toString({ colors: true, errors: true }));
                return;
            }
            serverReady = true;
            const resolvers = pendingResolvers;
            pendingResolvers = [];
            resolvers.forEach((r) => r());
        });

        // 3) ssrHandler：等 server 编译就绪 → require → render
        // getTemplate 注入 client bundle script 让浏览器拿到 webpack-hot-middleware client，建立 HMR
        const ssrHandler = createSSRRequestHandler({
            context: this.context,
            ssrConfig,
            serverBundlePath: () => serverBundlePath,
            waitUntilReady,
            onError: (e) => this.logger.error(`SSR 渲染失败: ${e?.message ?? e}`),
            getTemplate: async (_url) => {
                // 读取磁盘上的 template，再注入 client bundle <script>
                const fs = await import("node:fs/promises");
                const templatePath = ssrConfig.template
                    ? path.resolve(this.context, ssrConfig.template)
                    : path.resolve(this.context, "public/index.html");
                let html = await fs.readFile(templatePath, "utf-8");
                const publicPath = (clientConfig.output?.publicPath as string) || "/";
                const entryFile = (clientConfig.output as any)?.filename || "[name].js";
                // webpack adapter 把 string entry 包成 { app: entry }，chunk name = 'app'
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

        return [devMiddleware as IRequestHandler, hotMiddleware as IRequestHandler, ssrHandler];
    }
}
