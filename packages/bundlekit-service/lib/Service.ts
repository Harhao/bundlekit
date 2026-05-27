import path from "path";
import { pathToFileURL } from "url";
import PluginAPI from "./PluginAPI";
import ConfigLoader from "./ConfigLoader";
import { applyTools } from "./utils/applyTools";
import { buildSSRView } from "./utils/ssr";
import { startSSRDevServer, resolveDevServerBinding } from "./utils/ssrDevServer";
import { createJiti } from "jiti";

import { createRequire } from "module";
import { 
    FileManager,
    Logger, 
    PackageManager,
    confirm,
    BUNDLER_PACKAGE_MAP,
} from "@bundlekit/shared-utils";
import type {
    IBuildConfig,
    IBuildEnv,
    IBuildTools,
    IPluginAPIClass,
    IRegisterCommandItem,
    IRegisterPlugin,
    IToolsCtx,
} from "@bundlekit/shared-utils";

export default class Service {

    // 是否初始化
    private isInitial: boolean = false;
    // 打包工具环境
    private mode: IBuildEnv = "development";
    // 当前执行的命令名（serve / build / ...）
    private currentCommand: string | null = null;
    // 执行命令的目录
    public context: string | null = null;
    // 注册的命令集合
    public commands: Record<string, IRegisterCommandItem> = {};
    // 注册的插件集合
    public plugins: IRegisterPlugin[] = [];
    // 各插件运行环境集合
    private modes: Record<string, IBuildEnv> = {};
    // 文件操作类
    public fileManager: FileManager | null;
    // 依赖包安装类处理
    public packageManager: PackageManager | null;
    // 日志打印
    public logger: Logger = new Logger();
    // 需要跳过的插件列表
    private skipPlugins: Set<string> | null = null;
    // 传递进来的config配置
    private configLoader: ConfigLoader | null = null;
    // 打包工具配置
    private buildConfig: IBuildConfig | null = null;
    // 【中5】loadBundlerPlugin 实例级缓存，避免同一次构建多次解析同一包
    private bundlerPluginCache = new Map<string, any>();

    constructor(context?: string) {
        this.context = context || process.cwd();
        this.fileManager = new FileManager(this.context);
        this.packageManager = new PackageManager({
            context: this.context
        });
    }

    /**
     * 获取构建配置
     * @returns 构建配置
     */
    public getBuildConfig() {
        return this.buildConfig;
    }

    /**
     * 设置构建配置
     * @param config 构建配置
     */
    public setBuildConfig(config: IBuildConfig) {
        if (!config) {
            return;
        }
        this.buildConfig = config;
    }

    // 获取内置插件列表
    public async resolvePlugins() {

        const sortedPlugins: IRegisterPlugin[] = [];

        const builtInPlugins = [
            { id: "built-in:build",  module: await import("./commands/build").then(m => m.default) },
            { id: "built-in:serve",  module: await import("./commands/serve").then(m => m.default) },
            { id: "built-in:help",   module: await import("./commands/help").then(m => m.default)  },
        ];

        for (const { id, module: plugin } of builtInPlugins) {
            sortedPlugins.push({
                id,
                apply: plugin.apply,
                defaultModes: plugin.defaultModes,
            });
        }

        return sortedPlugins;
    }

    // 获取用户配置的插件列表（需在 buildConfig 加载后调用）
    private async resolveUserPlugins(): Promise<IRegisterPlugin[]> {
        const userPlugins: IRegisterPlugin[] = [];

        if (this.buildConfig?.plugins && Array.isArray(this.buildConfig.plugins)) {
            for (const pluginName of this.buildConfig.plugins) {
                try {
                    const require = createRequire(import.meta.url);
                    const pluginPath = require.resolve(pluginName, {
                        paths: [path.join(this.context, "node_modules")]
                    });
                    // 使用 jiti 加载，支持 .ts 源文件形式的插件包
                    const jiti = createJiti(import.meta.url);
                    const pluginModule = jiti(pluginPath) as any;
                    const resolved = pluginModule?.default || pluginModule;
                    if (resolved?.apply) {
                        userPlugins.push({
                            id: `project:${pluginName}`,
                            apply: resolved.apply,
                            defaultModes: resolved.defaultModes || {},
                        });
                    }
                } catch (e) {
                    this.logger.warn(`无法加载插件: ${pluginName}`, "插件管理");
                }
            }
        }

        return userPlugins;
    }

    /**
     * 初始化服务所有的配置
     * @param mode IBuildEnv 构建模式
     * @param args Record<string, unknown> 额外的参数
     */
    private async init(mode: IBuildEnv, args: Record<string, unknown>) {

        this.configLoader = new ConfigLoader(this.context, mode);
        // 要重新定义projectOptions类型
        const buildConfig = await this.configLoader.resolveAllConfig();
        // 设置构建配置
        this.setBuildConfig({ ...buildConfig, ...(args.bundler ? { bundler: args.bundler as IBuildTools } : {}) });

        // buildConfig 加载完成后，追加用户配置的插件
        const userPlugins = await this.resolveUserPlugins();
        this.plugins = [...this.plugins, ...userPlugins];

        for (let plugin of this.plugins) {
            // 如果不是需要跳过的插件, 则执行apply函数
            if (!this.skipPlugins?.has(plugin.id)) {
                const { id, apply } = plugin;
                const api = new PluginAPI({ id: id, service: this });
                apply(api as unknown as IPluginAPIClass, this.getBuildConfig());
            }
        }
    }

    /**
     * 收集需要跳过的插件
     * @param args 格式化参数
     * @param rawArgv 字符串参数
     */
    private setPluginsToSkip(args: Record<string, unknown>, rawArgv: string[]) {
        if (!this.skipPlugins) {
            this.skipPlugins = new Set();
        }
        const skipArg = (args["skip-plugin"] || args.skipPlugin || args["skip-plugins"]) as string;
        if (skipArg) {
            const pluginNames = skipArg.split(",").map((s: string) => s.trim()).filter(Boolean);
            for (const name of pluginNames) {
                this.skipPlugins.add(name);
            }
            this.logger.log(`跳过插件: ${Array.from(this.skipPlugins).join(", ")}`, "插件管理");
        }
    }

    /**
     * 处理打包工具的原生配置(暴露出去的配置)
     * @param config 打包工具的配置(针对具体的bundler配置)
     */
    public async configureConfig<T extends Record<string, unknown>>(config: T): Promise<T> {
        if (!this.buildConfig?.changeConfigure) {
            return config;
        }
        const result = this.buildConfig.changeConfigure(config as Record<string, unknown>, this.mode);
        return (result instanceof Promise ? await result : result) as T;
    }

    /**
     * 加载打包工具插件
     * @param packageName 打包工具插件的packageName
     * @returns 打包工具插件
     */
    public async loadBundlerPlugin(packageName: string) {
        // 命中缓存直接返回，避免同一次构建多次解析同一包
        if (this.bundlerPluginCache.has(packageName)) {
            return this.bundlerPluginCache.get(packageName);
        }
        try {
            // 优先从用户项目目录创建 require（确保解析到用户安装的包，而非 service 包自身位置）
            const ctxRequire = createRequire(
                path.join(this.context!, "package.json")
            );

            let resolvedPath: string | null = null;

            // 策略1：从用户项目目录解析
            try {
                resolvedPath = ctxRequire.resolve(packageName);
            } catch {
                // 策略2：从 service 自身位置解析（peerDependencies 可能在此找到）
                try {
                    const svcRequire = createRequire(import.meta.url);
                    resolvedPath = svcRequire.resolve(packageName);
                } catch { /* package not found anywhere */ }
            }

            let bundlerModule: any;

            if (resolvedPath) {
                try {
                    // 优先用 require 加载 CJS
                    bundlerModule = ctxRequire(resolvedPath);
                    bundlerModule = bundlerModule.default || bundlerModule;
                } catch (e: any) {
                    // ERR_REQUIRE_ESM 等情况：改用 dynamic import + file URL（绝对路径）
                    bundlerModule = await import(pathToFileURL(resolvedPath).href);
                    bundlerModule = bundlerModule.default || bundlerModule;
                }
            } else {
                // 兜底：bare specifier dynamic import
                bundlerModule = await import(packageName);
                bundlerModule = bundlerModule.default || bundlerModule;
            }

            this.bundlerPluginCache.set(packageName, bundlerModule);
            return bundlerModule;
        } catch (error: any) {
            this.logger.error(`无法加载打包工具插件: ${packageName}`, "构建工具");
            this.logger.error(`详细错误: ${error?.message ?? String(error)}`, "构建工具");
            return null;
        }
    }

    /**
     * 获取打包工具注册表（bundler 名称 → 适配器包名）
     * @returns IBuildTools
     */
    private getBundlerRegistry(): Record<IBuildTools, string> {
        return { ...BUNDLER_PACKAGE_MAP };
    }

    /**
     * bundler 缺失时按策略矩阵决定：
     * - TTY 且未设 DEVKIT_NO_PROMPT      → 弹 yes/no 询问
     * - 非 TTY 且 DEVKIT_AUTO_INSTALL=1  → 直接装入 devDeps
     * - 其他情况                          → 报错引导，返回 false
     */
    private async resolveBundlerOrPrompt(packageName: string): Promise<boolean> {
        const isTTY = !!process.stdout.isTTY && !!process.stdin.isTTY;
        const noPrompt = process.env.DEVKIT_NO_PROMPT === "1";
        const autoInstall = process.env.DEVKIT_AUTO_INSTALL === "1";

        let shouldInstall = false;

        if (isTTY && !noPrompt) {
            shouldInstall = await confirm({
                message: `未安装 ${packageName}，是否现在安装?`,
                default: true,
            });
        } else if (autoInstall) {
            this.logger.log(`检测到 DEVKIT_AUTO_INSTALL=1，自动安装 ${packageName}`, "构建工具");
            shouldInstall = true;
        } else {
            shouldInstall = false;
        }

        if (!shouldInstall) {
            const shortName = packageName.replace(/^@bundlekit\/bundler-/, "");
            this.logger.error(
                `未安装 ${packageName}。请先运行：\n  bundlekit-cli add bundler-${shortName}\n` +
                `或在 CI 中设置环境变量 DEVKIT_AUTO_INSTALL=1`,
                "构建工具",
            );
            return false;
        }

        if (!this.packageManager) {
            this.logger.error("packageManager is not initialized");
            return false;
        }

        const installed = await this.packageManager.add(packageName, { dev: true });
        if (!installed) {
            this.logger.error(`安装 ${packageName} 失败`, "构建工具");
            return false;
        }

        this.logger.done(`已安装 ${packageName} 至 devDependencies`, "构建工具");
        return true;
    }

    /**
     * 单次 pass 的执行流：transformConfig → tools → changeConfigure → run
     */
    private async runSinglePass(
        bundlerPlugin: any,
        passConfig: IBuildConfig,
        bundlerName: IBuildTools,
        env: "client" | "server",
    ): Promise<void> {
        const builder = new bundlerPlugin(this, this.mode);

        // server pass 的 ctx.env 切换为 'server'，给 tools hook 区分
        const toolsCtx: IToolsCtx = {
            mode: this.mode,
            command: (this.currentCommand === "build" ? "build" : "serve"),
            env,
            bundler: bundlerName,
        };

        const builderConifg = await builder.transformConfig(passConfig);
        const afterTools = await applyTools(passConfig.tools, bundlerName, builderConifg, toolsCtx);
        const finalConfig = await this.configureConfig(afterTools as Record<string, unknown>);
        await builder.run(finalConfig);
    }

    /**
     * 获取指定的bundler打包工具, 开始执行打包任务
     * @param bundler 打包工具名称 vite/webpack/rollup/rspack/rolldown
     */
    public async startBuilder() {

        const bundlerList = this.getBundlerRegistry();
        const finalBundler = this.buildConfig?.bundler || "vite";
        const packageName = bundlerList[finalBundler];

        let bundlerPlugin = await this.loadBundlerPlugin(packageName);

        // 如果打包工具不在默认列表中，则按策略矩阵决定是否安装并写入 devDependencies
        if (!bundlerPlugin) {
            const installed = await this.resolveBundlerOrPrompt(packageName);
            if (!installed) {
                throw new Error(`打包工具 ${packageName} 安装失败，无法继续`);
            }
            // 清除缓存以便重新解析刚安装的包
            this.bundlerPluginCache.delete(packageName);
            bundlerPlugin = await this.loadBundlerPlugin(packageName);
            if (!bundlerPlugin) {
                throw new Error(`安装后仍无法加载 ${packageName}，请检查 node_modules`);
            }
        }

        this.logger.log(`使用的构建：${finalBundler}`, "构建工具");

        // 检测是否启用 SSR：当前 envConfig 上有 ssr 字段
        const envConfig = this.buildConfig?.config?.[this.mode];
        const ssrEnabled = !!envConfig?.ssr;

        if (!ssrEnabled) {
            // 普通单 pass 流（保持向后兼容）
            await this.runSinglePass(bundlerPlugin, this.buildConfig!, finalBundler, "client");
            return;
        }

        // dev SSR 路径：service 起 HTTP server，adapter 提供 middleware 链
        const ssrDev = !!envConfig?.ssr?.dev;
        if (this.currentCommand === "serve" && ssrDev) {
            const builder = new bundlerPlugin(this, this.mode);
            if (typeof builder.createSSRMiddleware !== "function") {
                throw new Error(`bundler "${finalBundler}" 未实现 createSSRMiddleware，无法启动 dev SSR`);
            }
            try {
                const middleware = await builder.createSSRMiddleware(this.buildConfig!, {
                    env: "client",
                    isProduction: false,
                });
                const { host, port } = resolveDevServerBinding(this.buildConfig!, this.mode);
                const handle = await startSSRDevServer({
                    middleware,
                    host,
                    port,
                    onError: (err) => {
                        this.logger.error(`SSR middleware 异常: ${err?.message ?? err}`, "构建工具");
                    },
                });
                this.logger.done(
                    `SSR dev server 就绪：http://${host === "0.0.0.0" ? "localhost" : host}:${handle.port}`,
                    "构建工具",
                );
            } catch (err: any) {
                throw new Error(`启动 SSR dev server 失败: ${err?.message ?? err}`);
            }
            return;
        }

        // build SSR 双 pass：先 client，再 server
        this.logger.log(`SSR 模式启用：将依次执行 client + server 两次构建`, "构建工具");

        // Pass 1: client
        await this.runSinglePass(bundlerPlugin, this.buildConfig!, finalBundler, "client");

        // Pass 2: server（用 buildSSRView 切换 entry / output / target）
        const serverBuildConfig = buildSSRView(this.buildConfig!, this.mode);
        await this.runSinglePass(bundlerPlugin, serverBuildConfig, finalBundler, "server");

        this.logger.done(`SSR 双产物构建完成`, "构建工具");
    }

    /**
     * service 开始运行函数
     * @param command 执行的命令 build/serve/help 等等
     * @param args args = { _: ['serve'| 'build'], open: true, port: 880};
     * @param rawArgv 原始命令参数 rawArgv = ['serve', '--open', '--port', '8080']
     */
    public async run(command: string, args: Record<string, unknown>, rawArgv: string[] = []) {
        if (this.isInitial) {
            return;
        }

            this.isInitial = true;
            this.currentCommand = command;
            // 解析项目内插件和内置插件处理  
            this.plugins = await this.resolvePlugins();
            // 收集各插件依赖支持的环境
            this.modes = this.plugins.reduce((modes, plugin) => {
                if (plugin?.defaultModes) {
                    return { ...modes, ...plugin.defaultModes };
                }
                return modes;
            }, {});

            // 当前的环境
            this.mode = (typeof args.mode === 'string'
                ? args.mode
                : command === 'build' && args.watch
                    ? 'development'
                    : this.modes[command]) as IBuildEnv;

            // 需要跳过的插件       
            this.setPluginsToSkip(args, rawArgv);

            args._ = args._ || [];

            // 初始化操作
            await this.init(this.mode, args);

            let runCommand = this.commands[command];

            if (!runCommand && command) {
                throw new Error(`command "${command}" is not defined in bundlekit-service`);
            }

            if (!command || args.help || args.h) {
                runCommand = this.commands["help"];
            } else {
                (args._ as string[]).shift();
                rawArgv.shift();
            }

            const { fn } = runCommand;

            await fn(args, rawArgv);
    }
}