import path from "path";
import TransformConfig from "./transformConfig";
import Webpack, { Configuration } from "webpack";
import WebpackDevServer from "webpack-dev-server";

import { Logger, validateBuildConfig } from "@devkit/shared-utils";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv } from "@devkit/shared-utils";


export default class WebpackBundler implements IBuildToolAdapter<Configuration> {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    public name: string = "@devkit/bundler-webpack";

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

    private async prodBuild(config: Configuration) {
        try {
            Webpack(config, (err, stats) => {
                if (err) {
                    this.logger.error(`打包失败, 错误信息: ${err}`);
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
                    this.logger.error(`打包失败, 错误信息: ${err}`);
                    process.exit(1);
                }
            });
        } catch (e) {
            throw e;
        }
    }

    /**
     * 运行webpack进行打包构建
     * @param config Configuration webpack配置
     * @returns Promise<void>
     */
    public async run(config: Configuration) {
        try {
            this.logger.info(`开始使用webpack进行打包`);
            this.validateConfig(config);
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
            process.exit(1);
        }
    }
}