import { IBuildConfig } from "./config";

/**
 * connect-style middleware function: (req, res, next) => void
 * 不引入 connect 类型避免 shared-utils runtime 依赖
 */
export type IRequestHandler = (req: any, res: any, next: (err?: any) => void) => void;

/**
 * Tools hook ctx 在 SSR 双 pass 时区分 client / server
 */
export interface ISSRMiddlewareCtx {
    /** 当前 pass，dev SSR middleware 永远是 client（middleware 内部自己管 server pass） */
    env: "client" | "server";
    /** 是否生产模式（dev 通常 false） */
    isProduction: boolean;
}

export interface IBuildToolAdapter<T = any> {
    name: string; // 构建工具名称
    transformConfig: (config: IBuildConfig) => T | Promise<T>; // 转换成相对应的构建工具配置(rollup、webpack、esbuild等等都不太一样)
    validateConfig?: (config: T, buildConfig?: IBuildConfig) => boolean; // 验证配置是否正确
    run: (config: T) => Promise<void>; // 运行构建工具方法
    /**
     * dev SSR middleware（可选）
     * 启用 ssr.dev=true 时由 service 调用，返回 connect 风格中间件链
     * 不实现该方法的 adapter 在 dev SSR 模式下会被 service 报错
     */
    createSSRMiddleware?: (
        config: IBuildConfig,
        ctx: ISSRMiddlewareCtx,
    ) => Promise<IRequestHandler | IRequestHandler[]>;
};
  
export type IBuildTools = "vite" | "webpack" | "rollup" | "rspack" | "rolldown";