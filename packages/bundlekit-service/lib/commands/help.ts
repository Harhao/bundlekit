import { Logger } from "@bundlekit/shared-utils";
import type { IBuildConfig, IPluginAPIClass, IRegisterCommandItem } from "@bundlekit/shared-utils";

export default {
    defaultModes: {
        help: "developement",
    },
    apply: (api: IPluginAPIClass, options: IBuildConfig) => {
        const logger = new Logger();
        const commands = api.service.commands;

        /** 打印命令用法；filterOnly 为 true 时只打印该命令，否则打印其他所有命令 */
        function printCommandUsage(targetCommand?: string) {
            for (const command in commands) {
                const shouldPrint = targetCommand ? command === targetCommand : command !== "help";
                if (!shouldPrint) continue;
                logger.done("使用方法:", command);
                const { opts } = commands[command] as IRegisterCommandItem;
                if (typeof opts !== "function") {
                    logger.printRecord(opts.options);
                }
            }
        }

        api.registerCommand(
            "help",
            {
                description: "打包生产环境服务, 'bundlekit-serve help 打印帮助信息",
                usage: "bundlekit-service help",
                options: {
                    "--help": "输出帮助信息",
                    "--version": "输出当前bundlekit-service版本",
                }
            },
            async (args: Record<string, unknown>, rawArgv: string[] = []) => {
                // 打印帮助信息
                const command = (args._ as string[])?.[0];
                !command ? printCommandUsage() : printCommandUsage("help");
            });
    }
};