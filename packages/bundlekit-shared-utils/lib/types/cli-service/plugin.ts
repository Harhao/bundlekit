import { IBuildConfig } from "./config";
import { IBuildEnv } from "./env";
import { IService } from "./service";

export type IRegisterCommandOptions = {
   description: string;
   usage: string;
   options: Record<string, string>;
} | IRegisterCommandCallback;

export type IRegisterCommandCallback = (
   args: Record<string, unknown>,
   rawArgv?: string[]
) => Promise<void>;

export type IRegisterCommandFunction = (
   api: IPluginAPIClass,
   options: IRegisterCommandOptions,
   func: IRegisterCommandCallback,
) => void;

export interface IRegisterCommandItem {
   opts: IRegisterCommandOptions;
   fn: IRegisterCommandCallback;
}

export interface IRegisterPlugin {
   id: string;
   defaultModes: Record<string, IBuildEnv | string>;
   apply: (api: IPluginAPIClass, options: IBuildConfig) => void;
}

export interface IPluginAPIClass {
   service: IService;
   registerCommand: (
      name: string,
      options: IRegisterCommandOptions | IRegisterCommandCallback,
      fn?: IRegisterCommandCallback
   ) => void;
}

/**
 * Generator API —— CLI 传给各插件 generator 的上下文接口。
 * generator 通过此接口与 CLI 交互，不直接依赖任何具体提示库。
 */
export interface IGeneratorAPI {
    /** 向用户发起交互式提问，底层由 CLI 的 Enquirer 驱动 */
    prompt<T extends Record<string, any> = Record<string, any>>(
        questions: any[]
    ): Promise<T>;
    /** 输出成功提示 */
    log(message: string): void;
    /**
     * 声明要追加的 npm 依赖。
     * CLI 会将其写入 package.json，并在 generator 执行完成后统一安装。
     * @param pkgName 包名，如 "@bundlekit/request"
     * @param version 版本范围，默认 "latest"
     * @param dev    是否写入 devDependencies，默认 false
     */
    addDependency(pkgName: string, version?: string, dev?: boolean): void;
}
