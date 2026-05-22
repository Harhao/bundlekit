import http from "node:http";
import type { IBuildConfig, IRequestHandler, IBuildEnv } from "@bundlekit/shared-utils";

/**
 * 简易 connect 风格 middleware 链运行器。
 *
 * 不引入 connect 依赖：service 通过 http.createServer 起服务，把 adapter 返回的
 * middleware 数组按顺序调用；任意 middleware 调 next(err) 触发错误兜底，调 next()
 * 不带参数则进入下一项；无 next 调用则视作终止响应（已写 res.end）。
 */
function runMiddlewares(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    mws: IRequestHandler[],
): Promise<void> {
    return new Promise((resolve, reject) => {
        let i = 0;
        const next = (err?: any) => {
            if (err) return reject(err);
            if (i >= mws.length) return resolve();
            const mw = mws[i++];
            try {
                const r: any = mw(req, res, next);
                if (r && typeof r.then === "function") {
                    r.then(undefined, reject);
                }
            } catch (e) {
                reject(e);
            }
        };
        next();
    });
}

export interface ISSRDevServerOptions {
    /** adapter 返回的 middleware（单个或数组） */
    middleware: IRequestHandler | IRequestHandler[];
    /** 监听 host */
    host: string;
    /** 监听 port */
    port: number;
    /** 错误日志钩子 */
    onError?: (err: any) => void;
}

export interface ISSRDevServerHandle {
    /** 真实绑定到的端口（端口为 0 时由系统分配） */
    port: number;
    /** 关闭服务器 */
    close: () => Promise<void>;
}

/**
 * 启动 dev SSR HTTP server：把 adapter 的 middleware 链串到 http.createServer 上。
 *
 * 错误语义：
 *   - middleware 抛错 → 返回 500 + stack overlay（dev 友好），生产不应启用 dev SSR
 *   - 服务器自身 EADDRINUSE / 其他启动错 → reject promise
 */
export async function startSSRDevServer(
    opts: ISSRDevServerOptions,
): Promise<ISSRDevServerHandle> {
    const mws: IRequestHandler[] = Array.isArray(opts.middleware)
        ? opts.middleware
        : [opts.middleware];

    const server = http.createServer((req, res) => {
        runMiddlewares(req, res, mws).catch((err) => {
            opts.onError?.(err);
            if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "text/html; charset=utf-8");
            }
            const safeStack = String(err?.stack || err?.message || err)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;");
            res.end(`<pre>${safeStack}</pre>`);
        });
    });

    return new Promise<ISSRDevServerHandle>((resolve, reject) => {
        server.once("error", reject);
        server.listen(opts.port, opts.host, () => {
            const addr = server.address();
            const port = typeof addr === "object" && addr ? addr.port : opts.port;
            server.removeListener("error", reject);
            resolve({
                port,
                close: () =>
                    new Promise<void>((res2) => {
                        server.close(() => res2());
                    }),
            });
        });
    });
}

/**
 * 从 buildConfig 中读取 envConfig（按 mode）的 devServer.host/port，回退到默认值
 */
export function resolveDevServerBinding(
    buildConfig: IBuildConfig,
    mode: IBuildEnv,
): { host: string; port: number } {
    const envConfig = buildConfig.config?.[mode];
    const host = envConfig?.devServer?.host || "0.0.0.0";
    const port =
        typeof envConfig?.devServer?.port === "number"
            ? envConfig.devServer.port
            : 3000;
    return { host, port };
}
