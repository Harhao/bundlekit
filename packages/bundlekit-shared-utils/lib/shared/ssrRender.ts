import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { IRequestHandler, ISSRConfig } from "../types";

/**
 * 共享 SSR HTML render 工具。
 *
 * 适用：webpack / rspack / rollup / rolldown 等没有原生 SSR API 的 bundler，统一用
 * 「编译出 server bundle 文件 → require 进来调 render(url) → 替换 placeholder」的流程。
 *
 * vite 因为自带 ssrLoadModule + transformIndexHtml，不走这个 helper（自行实现）。
 */

export interface ISSRHandlerOptions {
    /** 项目根目录 */
    context: string;
    /** ssr 配置 */
    ssrConfig: ISSRConfig;
    /** server bundle 编译产物的绝对路径（每次请求 require 此路径） */
    serverBundlePath: () => string | Promise<string>;
    /** 拿到模板字符串的回调；未传则按 `template` 字段读盘 */
    getTemplate?: (url: string) => string | Promise<string>;
    /** 错误回调（dev overlay 之外另行打日志） */
    onError?: (err: any) => void;
    /**
     * 等待编译就绪的 hook：每次请求进来时，如果 watcher 还在编译，应当 await
     * 直到 server bundle 写到磁盘，再继续 require。
     */
    waitUntilReady?: () => Promise<void>;
}

/**
 * 清掉 require 缓存中以 serverBundlePath 为前缀的模块，确保下一次 require 拿到最新产物。
 *
 * 注：webpack/rspack 输出 cjs 时，bundle 是单文件 + 入口 require → 我们清入口即可。
 * 其他 bundler 如果产物是分片 cjs，递归清整个目录。
 */
function clearRequireCache(absPath: string): void {
    try {
        const require = createRequire(import.meta.url);
        const resolved = require.resolve(absPath);
        // 清自身
        delete (require as any).cache?.[resolved];
        // 兜底：清整个 dist/server 目录
        const dir = path.dirname(resolved);
        const cache = (require as any).cache;
        if (cache) {
            for (const key of Object.keys(cache)) {
                if (key.startsWith(dir)) {
                    delete cache[key];
                }
            }
        }
    } catch {
        // ignore — bundle 可能还没编译出来，第一次 require 会触发新解析
    }
}

/**
 * 创建一个 connect-style middleware：每次请求都重新 require server bundle 调 render(url)。
 *
 * 注意：require 是同步阻塞的；render 可以是 async。
 */
export function createSSRRequestHandler(opts: ISSRHandlerOptions): IRequestHandler {
    const placeholder = opts.ssrConfig.placeholder || "<!--ssr-outlet-->";
    const templateFile = opts.ssrConfig.template
        ? path.resolve(opts.context, opts.ssrConfig.template)
        : path.resolve(opts.context, "public/index.html");

    return async (req, res) => {
        try {
            const url = req.url || "/";

            // 1. 等编译完成
            if (opts.waitUntilReady) {
                await opts.waitUntilReady();
            }

            // 2. 解析最新 server bundle 路径并清缓存
            const bundlePath = await opts.serverBundlePath();
            clearRequireCache(bundlePath);

            // 3. require server bundle，拿到 render 函数
            // 兼容多种模块格式：
            //   - ESM compiled to CJS: mod.render
            //   - ESM default export:  mod.default.render
            //   - Webpack CommonJS2:   mod.exports.render 或 mod.exports.default.render
            //   - @ngtools/webpack:    mod 可能有多层嵌套
            const require = createRequire(import.meta.url);
            const mod = require(bundlePath);
            const render = mod?.render
                || mod?.default?.render
                || mod?.exports?.render
                || mod?.exports?.default?.render
                || (typeof mod === "function" ? mod : undefined);
            if (typeof render !== "function") {
                // 调试：打印 mod 的结构帮助定位
                const modKeys = mod ? Object.keys(mod) : [];
                const defaultKeys = mod?.default ? Object.keys(mod.default) : [];
                throw new Error(
                    `${opts.ssrConfig.entry} 必须 export 一个 \`render(url): string | Promise<string>\` 函数（实际产物：${bundlePath}，keys: ${modKeys.join(",")}，default.keys: ${defaultKeys.join(",")}）`,
                );
            }

            // 4. 拿到 HTML 模板（adapter 可重写注入 dev script，否则直接读盘）
            let template: string;
            if (opts.getTemplate) {
                template = await opts.getTemplate(url);
            } else {
                template = fs.readFileSync(templateFile, "utf-8");
            }

            // 5. 调 render，替换 placeholder
            const appHtml = await render(url);
            const html = template.includes(placeholder)
                ? template.replace(placeholder, String(appHtml))
                : template.replace(/<\/body>/i, `${appHtml}</body>`);

            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
        } catch (err: any) {
            opts.onError?.(err);
            if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "text/html; charset=utf-8");
            }
            const safeStack = String(err?.stack || err?.message || err)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;");
            res.end(`<pre>SSR render error\n${safeStack}</pre>`);
        }
    };
}
