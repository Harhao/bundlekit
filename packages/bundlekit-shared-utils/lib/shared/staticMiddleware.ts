/**
 * 静态文件服务 middleware（connect 风格），用于在 dev SSR 中间件链里
 * 提供 client bundle 的下载。
 *
 * 行为：
 *   - 命中 outDir 下的文件 → 200 + 正确 MIME 写出
 *   - 未命中 → 调 next() 继续后续 middleware（SSR handler）
 *   - 显式忽略 index.html 命中（让 SSR handler 接管文档请求；用户如果硬要看
 *     bundler 生成的 dist/index.html 可以加 ?__bk_static=1 query 跳过 SSR，
 *     但本 middleware 不实现该旁路，保持职责单一）
 *
 * 与 DevServer.ts 的关系：
 *   - DevServer.ts 是 rollup/rolldown 非 SSR 场景下的完整 dev server，
 *     里面已内嵌一份静态文件 + proxy + SSE 逻辑，本工具不试图重构它。
 *   - 本工具针对 SSR middleware 模式：仅负责静态 fall-through 行为，
 *     proxy / livereload 等不在其职责内。
 */
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import type { IRequestHandler } from "../types";

const DEFAULT_MIME_TYPES: Record<string, string> = {
    ".html":  "text/html; charset=utf-8",
    ".js":    "application/javascript; charset=utf-8",
    ".mjs":   "application/javascript; charset=utf-8",
    ".cjs":   "application/javascript; charset=utf-8",
    ".css":   "text/css; charset=utf-8",
    ".json":  "application/json; charset=utf-8",
    ".map":   "application/json",
    ".png":   "image/png",
    ".jpg":   "image/jpeg",
    ".jpeg":  "image/jpeg",
    ".gif":   "image/gif",
    ".svg":   "image/svg+xml; charset=utf-8",
    ".ico":   "image/x-icon",
    ".webp":  "image/webp",
    ".woff":  "font/woff",
    ".woff2": "font/woff2",
    ".ttf":   "font/ttf",
    ".eot":   "application/vnd.ms-fontobject",
    ".txt":   "text/plain; charset=utf-8",
    ".xml":   "application/xml",
};

export interface IStaticFileMiddlewareOptions {
    /** 静态资源根目录的绝对路径 */
    outDir: string;
    /**
     * URL 前缀，默认 "/"。当 envConfig.publicPath 不是 "/" 时（例如 "/static/"），
     * 只有以该前缀开头的请求会被解析；解析时会先去掉这段前缀再去 outDir 找文件。
     */
    publicPath?: string;
    /**
     * 是否把 index.html 命中也交给 next() 处理（让 SSR handler 接管文档请求），
     * 默认 true。设为 false 时静态层也会响应 index.html（一般用于纯 CSR 场景）。
     */
    skipIndexHtml?: boolean;
    /** 额外或覆盖 MIME 映射 */
    extraMimeTypes?: Record<string, string>;
}

/**
 * 创建一个 connect 风格的静态文件 middleware。
 */
export function createStaticFileMiddleware(
    opts: IStaticFileMiddlewareOptions,
): IRequestHandler {
    const outDir = path.resolve(opts.outDir);
    const publicPath = opts.publicPath ?? "/";
    const prefix = publicPath.endsWith("/") ? publicPath : publicPath + "/";
    const skipIndexHtml = opts.skipIndexHtml !== false;
    const mimeTypes = { ...DEFAULT_MIME_TYPES, ...(opts.extraMimeTypes || {}) };

    return (req, res, next) => {
        // 仅 GET / HEAD 走静态层；其他方法直接放行
        const method = (req as any).method as string | undefined;
        if (method && method !== "GET" && method !== "HEAD") return next?.();

        let url = req.url || "/";
        // 剔除 query / hash
        const qIdx = url.indexOf("?");
        if (qIdx >= 0) url = url.slice(0, qIdx);
        const hIdx = url.indexOf("#");
        if (hIdx >= 0) url = url.slice(0, hIdx);

        try { url = decodeURIComponent(url); } catch { /* ignore */ }

        // publicPath 前缀过滤
        if (prefix !== "/" && !url.startsWith(prefix)) return next?.();
        const rel = url.slice(prefix.length === 0 ? 0 : prefix.length === 1 ? 1 : prefix.length);
        // 跳过 "/" 或空（让 SSR handler 处理）
        if (!rel || rel === "" || rel === "/") return next?.();

        // 防目录穿越：拒绝包含 ".." 的相对路径
        if (rel.split("/").some((seg) => seg === "..")) return next?.();

        const filePath = path.join(outDir, rel);
        // 确保解析后路径仍在 outDir 内
        if (!filePath.startsWith(outDir + path.sep) && filePath !== outDir) return next?.();

        let stat;
        try { stat = statSync(filePath); } catch { return next?.(); }
        if (!stat.isFile()) return next?.();

        const ext = path.extname(filePath).toLowerCase();
        // skipIndexHtml：让 SSR handler 接管所有 .html 请求
        if (skipIndexHtml && ext === ".html") return next?.();

        const mime = mimeTypes[ext] ?? "application/octet-stream";
        (res as any).statusCode = 200;
        (res as any).setHeader("Content-Type", mime);
        (res as any).setHeader("Content-Length", stat.size);
        if (method === "HEAD") {
            (res as any).end();
            return;
        }
        createReadStream(filePath).pipe(res as any);
    };
}
