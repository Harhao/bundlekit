import { IRegisterCommandItem, IRegisterPlugin } from "./plugin";
import type { FileManager, Logger, PackageManager } from "../../shared";
import { IBuildConfig } from "./config";

export interface IService {
    // 执行命令的目录
    context: string | null;
    // 日志打印
    logger: Logger;
    // 构建配置
    buildConfig: IBuildConfig | null;
    // 注册的命令集合
    commands: Record<string, IRegisterCommandItem>;
    // 注册的插件集合
    plugins: IRegisterPlugin[];
    // 文件操作类
    fileManager: FileManager | null;
    // 依赖包安装类处理
    packageManager: PackageManager | null;
    // 获取构建配置
    getBuildConfig(): IBuildConfig | null;
    // 设置构建配置
    setBuildConfig(config: IBuildConfig): void;
    // 获取插件列表
    resolvePlugins(): Promise<IRegisterPlugin[]>;
    // 加载环境变量
    loadEnv(): Promise<void>;
    // 启动构建工具
    startBuilder(): Promise<void>;
    // 运行命令
    run(command: string, args: Record<string, unknown>, rawArgv?: string[]): Promise<void>;
}