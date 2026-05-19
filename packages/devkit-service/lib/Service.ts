import path from "path";
import PluginAPI from "./PluginAPI";
import ConfigLoader from "./ConfigLoader";

import { createRequire } from "module";
import { 
    FileManager,
    Logger, 
    PackageManager,
} from "@devkit/shared-utils";
import type {
    IBuildConfig,
    IBuildEnv,
    IBuildTools,
    IPluginAPIClass,
    IRegisterCommandItem,
    IRegisterPlugin,
} from "@devkit/shared-utils";

export default class Service {

    // 是否初始化
    private isInitial: boolean = false;
    // 打包工具环境
    private mode: IBuildEnv = "development";
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

    // 获取插件列表
    public async resolvePlugins() {

        const sortedPlugins: IRegisterPlugin[] = [];

        const builtInPlugins = [
            await import("./commands/build").then(m => m.default),
            await import("./commands/serve").then(m => m.default),
            await import("./commands/help").then(m => m.default)
        ];

        for (let plugin of builtInPlugins) {
            const { defaultModes, apply } = plugin;
            sortedPlugins.push({
                id: `built-in:${plugin.defaultModes ? Object.keys(plugin.defaultModes)[0] : 'unknown'}`,
                apply: apply,
                defaultModes,
            });
        }

        if (this.buildConfig?.plugins && Array.isArray(this.buildConfig.plugins)) {
            for (const pluginName of this.buildConfig.plugins) {
                try {
                    const require = createRequire(import.meta.url);
                    const pluginPath = require.resolve(pluginName, {
                        paths: [path.join(this.context, "node_modules")]
                    });
                    const pluginModule = (await import(pluginPath)).default || (await import(pluginPath));
                    if (pluginModule.apply) {
                        sortedPlugins.push({
                            id: `project:${pluginName}`,
                            apply: pluginModule.apply,
                            defaultModes: pluginModule.defaultModes || {},
                        });
                    }
                } catch (e) {
                    this.logger.warn(`无法加载插件: ${pluginName}`, "插件管理");
                }
            }
        }

        return sortedPlugins;
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
        this.setBuildConfig({ ...buildConfig, bundler: args.bundler as IBuildTools });

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
     * @param config 打包工具的配置(针对具体的bundler配置， 所以这里config的类型是Record<string, unknown>)
     * @returns Recodr<string, unknown>
     */
    public async configureConfig(config: Record<string, unknown>) {

        if (!this.buildConfig?.changeConfigure) {
            return config;
        }
        const result = this.buildConfig.changeConfigure(config, this.mode);
        return result instanceof Promise ? await result : result;
    }

    /**
     * 加载打包工具插件
     * @param packageName 打包工具插件的packageName
     * @returns 打包工具插件
     */
    public async loadBundlerPlugin(packageName: string) {
        try {
            const require = createRequire(import.meta.url);
            let bundlerModule;
            try {
                // 显式指定查找路径，优先当前 context 的 node_modules
                const packagePath = require.resolve(packageName, {
                    paths: [
                        path.join(this.context, "node_modules"),
                        path.join(process.cwd(), "node_modules")
                    ]
                });
                bundlerModule = require(packagePath);
                bundlerModule = bundlerModule.default || bundlerModule;
            } catch (e) {
                // fallback: 动态 import
                bundlerModule = await import(packageName);
                bundlerModule = bundlerModule.default || bundlerModule;
            }
            return bundlerModule;
        } catch (error) {
            this.logger.error(`无法加载打包工具插件: ${packageName}`, "构建工具");
            return null;
        }
    }

    /**
     * 获取打包工具注册表（bundler 名称 → 适配器包名）
     * @returns IBuildTools
     */
    private getBundlerRegistry(): Record<IBuildTools, string> {
        return {
            webpack: "@devkit/bundler-webpack",
            vite: "@devkit/bundler-vite",
            rollup: "@devkit/bundler-rollup",
            rspack: "@devkit/bundler-rspack",
            rolldown: "@devkit/bundler-rolldown",
        };
    }

    /**
     * 获取指定的bundler打包工具, 开始执行打包任务
     * @param bundler 打包工具名称 vite/webpack/rollup/rspack/rolldown
     */
    public async startBuilder() {

        const bundlerList = this.getBundlerRegistry();
        const finalBundler = this.buildConfig?.bundler || "vite";
        const packageName = bundlerList[finalBundler];

        let isInstallBundler = !!(await this.loadBundlerPlugin(packageName));

        // 如果打包工具不在默认列表中，则需要安装
        if (!isInstallBundler) {

            // 安装打包依赖, 安装bundler插件package
            if (!this.packageManager) {
                this.logger.error('packageManager is not initialized');
                return;
            }
            isInstallBundler = await this.packageManager.add(packageName, {
                noSave: true,
            });
        }

        if (!!isInstallBundler) {

            this.logger.log(`使用的构建：${finalBundler}`, "构建工具");
            // 加载打包工具插件
            const bundlerPlugin = await this.loadBundlerPlugin(packageName);

            // 实例化打包工具插件
            let builder = new bundlerPlugin(this, this.mode);

            // 转换成相对应构建工具的配置
            const builderConifg = builder.transformConfig(this.buildConfig);
            // 处理构建工具的原生配置(暴露出去的配置项)
            const finalConfig = await this.configureConfig(builderConifg);
            // 开始运行构建任务
            await builder.run(finalConfig);
        }
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
                this.logger.error(`command ${command} is not defined in devkit-service`);
                process.exit(1);
            }

            if (!command || args.help || args.h) {
                runCommand = this.commands["help"];
            } else {
                (args._ as string[]).shift();
                rawArgv.shift();
            }

            const { fn } = runCommand;

            fn(args, rawArgv);
    }
}