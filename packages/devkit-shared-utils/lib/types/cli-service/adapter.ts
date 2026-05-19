import { IBuildConfig } from "./config";

export interface IBuildToolAdapter<T = any> {
    name: string; // 构建工具名称
    transformConfig: (config: IBuildConfig) => T | Promise<T>; // 转换成相对应的构建工具配置(rollup、webpack、esbuild等等都不太一样)
    validateConfig?: (config: T, buildConfig?: IBuildConfig) => boolean; // 验证配置是否正确
    run: (config: T) => Promise<void>; // 运行构建工具方法
};
  
export type IBuildTools = "vite" | "webpack" | "rollup" | "rspack" | "rolldown";