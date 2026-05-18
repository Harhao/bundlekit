import { Logger } from "@devkit/shared-utils";
import type { IBuildConfig, IPluginAPIClass, IRegisterCommandItem } from "@devkit/shared-utils";

export default {
    defaultModes: {
        help: "developement",
    },
    apply: (api: IPluginAPIClass, options: IBuildConfig) => {
        const logger = new Logger();
        const commands = api.service.commands;

        function printHelp() {
            // 打印帮助信息
            for(const command in commands) {
                if (command === "help") {
                    logger.done("使用方法:", command);
                    const { opts } = commands[command] as IRegisterCommandItem;
                    if (typeof opts !== "function") {
                        logger.printRecord(opts.options);
                    }
                }
            }
        }

        function printAllCommandUsage() {

            for(const command in commands) {
                if (command !== "help") {
                    logger.done("使用方法:", command);
                    const { opts } = commands[command] as IRegisterCommandItem;
                    if (typeof opts !== "function") {
                        logger.printRecord(opts.options);
                    }
                }
            }
        }

        api.registerCommand(
            "help",
            {
                description: "打包生产环境服务, 'devkit-serve help 打印帮助信息",
                usage: "devkit-service help",
                options: {
                    "--help": "输出帮助信息",
                    "--version": "输出当前devkit-service版本",
                }
            },
            async (args: Record<string, unknown>, rawArgv: string[] = []) => {
                // 打印帮助信息
                const command = args._[0] as string;
                console.log("args", args, rawArgv);
                !command ? printAllCommandUsage() : printHelp();
            });
    }
};