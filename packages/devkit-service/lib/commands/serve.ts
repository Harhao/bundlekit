import type { IBuildConfig, IPluginAPIClass, IBuildTools } from "@devkit/shared-utils";
import { getDefaultConfig } from "../config/defaultConfig";

export default {
    defaultModes: {
        serve: "developement",
    },
    apply: (api: IPluginAPIClass, options: IBuildConfig) => {

        const defaultConfig = getDefaultConfig(api.service.context);

        api.registerCommand("serve", {
            description: "开启开发环境服务, 'devkit-serve serve [options] [entry]' 启动开发服务",
            usage: "devkit serve [options] [entry]",
            options: {
                "--open": "利用浏览器打开页面地址",
                "--copy": "在启动时拷贝地址到剪贴板📋",
                "--stdin": "当stdin被关闭时，关闭服务器。",
                "--mode": "声明运行的环境 (默认: development)",
                "--host": `声明支持的hostname (默认: ${defaultConfig.config.development.devServer?.host || "0.0.0.0"})`,
                "--port": `声明端口号 (默认: ${defaultConfig.config.development.devServer?.port || 3000})`,
                "--https": `使用https (默认: ${defaultConfig.config.development.devServer?.https ? "true" : "false"})`,
                "--bundler": `指定构建工具来构建(默认: ${defaultConfig.bundler})`,
                "--config": `制定配置文件地址 (默认: .devkitrc.mjs或.devkitrc.ts)`,
                "--skip-plugin": "跳过指定插件，多个插件用逗号分隔",
            }
        }, async (args: Record<string, any>, rawArgv: string[] = []) => {

            const buildConfig = api.service.getBuildConfig();
            if (!buildConfig) return;

            const mode = (args.mode || buildConfig.mode || "development") as string;
            const envConfig = buildConfig.config?.[mode] || buildConfig.config?.development || {};

            envConfig.devServer = {
                ...(envConfig.devServer || {}),
                ...(args.open !== undefined && { open: !!args.open }),
                ...(args.host !== undefined && { host: args.host }),
                ...(args.port !== undefined && { port: Number(args.port) }),
                ...(args.https !== undefined && { https: !!args.https }),
            };

            if (args.bundler) {
                buildConfig.bundler = args.bundler as IBuildTools;
            }

            if (args.stdin) {
                process.stdin.on('end', () => {
                    api.service.logger.log('stdin 已关闭，正在关闭服务器...', "开发服务");
                    process.exit(0);
                });
            }

            api.service.setBuildConfig(buildConfig);
            api.service.startBuilder();
        });
    }
};
