import semver from "semver";
import minimist from "minimist";
import Service from "./lib/Service";
import pkg from "./package.json" assert { type: "json" };
import { Logger } from "@devkit/shared-utils";

async function startBuildService() {
    const logger = new Logger();
    try {
        // 检查node版本
        let requireNodeVersion = pkg.engines.node;
        if (!semver.satisfies(process.version, requireNodeVersion, { includePrerelease: true })) {
            //增加打印错误信息
            logger.error(
                `Required node version ${requireNodeVersion}, but got ${process.version}.\nPlease upgrade your node.`
            );
            process.exit(1);
        }

        const service =  new Service();
        const rawArgv = process.argv.slice(2);
        const args = minimist(rawArgv, {
            // TODO 这里可以增加更多的参数转成布尔值
            boolean: [
                "open",
            ]
        });
        const command = args._[0];
        await service.run(command, args, rawArgv);

        // 增加 process 中断监听处理
        process.on('SIGINT', () => {
            logger.info('接收到 SIGINT 信号，正在优雅关闭服务...');
            // 这里可以添加关闭服务的逻辑
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            logger.info('接收到 SIGTERM 信号，正在优雅关闭服务...');
            // 这里可以添加关闭服务的逻辑
            process.exit(0);
        });
       
    } catch (error) {
        // 增加打印错误信息
        logger.error(error);
        process.exit(1);
    }
}

startBuildService();