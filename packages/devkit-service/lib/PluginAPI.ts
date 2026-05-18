import { IBuildConfig, IRegisterCommandCallback, IRegisterCommandOptions } from "@devkit/shared-utils";
import pkg from "../package.json" assert { type: "json" };
import type Service from "./Service";

export interface IPluginConfig {
    id: string;
    service: Service;
};
export default class PluginAPI {

    private id: string | null = null; // 插件id名称
    private service: Service | null = null; // 主流程service实例

    // 插件构造函数
    constructor(config: IPluginConfig) {
        const { id, service } = config;
        this.id = id;
        this.service = service;
    }

    // 获取插件名称
    public get pluginName() {
        return this.id;
    }

    // 获取cli版本
    public get version() {
        return pkg.version;
    }

    // 获取当前运行路径地址
    public getCwd() {
        return this.service.context;
    }

    /**
     * 注册命令
     * @param command 命令名称
     * @param args 命令参数 args = { _: ['serve'| 'build'], open: true, port: 880};
     * @param rawArgs 原始命令参数 rawArgv = ['serve', '--open', '--port', '8080']
     */
    public registerCommand(
        command: string,
        opts: IRegisterCommandOptions,
        fn: IRegisterCommandCallback,
    ) {
        if (typeof opts === 'function') {
            fn = opts
            opts = null
        }
        this.service.commands[command] = { fn, opts: (opts || {}) as IRegisterCommandOptions };
    }

    /**
     * 添加构建工具包
     * @param packageName 包名称
     */
    public async addBuildPackage(packageName: string) {
        await this.service.packageManager.add(
            packageName, {
            noSave: true,
        });
    }

    /**
     * 修改构建配置
     * @param config 构建配置
     */
    public modifyBuildConfig(config: IBuildConfig) {
        this.service.setBuildConfig(config);        
    }
}
