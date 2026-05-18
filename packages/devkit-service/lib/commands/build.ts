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
                "--dest": "声明打包的输出目录 (默认: dist)",
                "--no-clean": "载在生产产物之前不清除输出目录",
                "--filename": "指定打包的文件名称(只可在lib包模式下生效)",
                "--formats": "选项用于指定库构建时的输出格式, 支持umd/commonjs/esm (以逗号进行分隔)",
                "--config": `制定配置文件地址 (默认: devkit.config.mjs或者devkit.config.ts))`,
                "--skip-plugins": "跳过指定的插件(多个插件以逗号分隔)",
                "--name": "支持声明lib包名称或者web-component 模式(默认：package.json中的name或者web-component的target)",
            }
        }, async (args: Record<string, unknown>, rawArgv: string[] = []) => {         
            // 开始构建
            api.service.startBuilder();
        });
    }
};