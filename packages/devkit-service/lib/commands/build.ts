import type { IBuildConfig, IPluginAPIClass } from "@devkit/shared-utils";

export default {
    defaultModes: {
        build: "production",
    },
    apply: (api: IPluginAPIClass, options: IBuildConfig) => {
        // 注册命令
        api.registerCommand("build", {
            description: "打包生产环境服务, 'devkit-serve build [options] [entry]' 启动开发服务",
            usage: "devkit build [options] [entry]",
            options: {
                "--mode": "声明运行的环境 (默认: production)",
                "--skip-plugins": "跳过指定的插件(多个插件以逗号分隔)",
            }
        }, async (args: Record<string, unknown>, rawArgv: string[] = []) => {         
            // 开始构建
            api.service.startBuilder();
        });
    }
};