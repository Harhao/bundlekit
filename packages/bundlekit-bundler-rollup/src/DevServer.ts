/**
 * DevServer for rollup / rolldown dev mode
 *
 * Features:
 *  - Static file serving with correct MIME types
 *  - SPA history-API fallback (index.html)
 *  - SSE-based livereload (no extra dependencies)
 *  - Reverse proxy (native http/https, no extra dependencies)
 *  - Auto browser open
 */
import http from "http";
import https from "https";
import { createReadStream, statSync, readFileSync } from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import type { AddressInfo } from "net";
import type { Logger } from "@bundlekit/shared-utils";

// ─── MIME types ────────────────────────────────────────────────────────────────
const MIME_TYPES: Record<string, string> = {
    ".html":  "text/html; charset=utf-8",
    ".js":    "application/javascript; charset=utf-8",
    ".mjs":   "application/javascript; charset=utf-8",
    ".cjs":   "application/javascript; charset=utf-8",
    ".css":   "text/css; charset=utf-8",
    ".json":  "application/json; charset=utf-8",
    ".png":   "image/png",
    ".jpg":   "image/jpeg",
    ".jpeg":  "image/jpeg",
    ".gif":   "image/gif",
    ".svg":   "image/svg+xml; charset=utf-8",
    ".ico":   "image/x-icon",
    ".woff":  "font/woff",
    ".woff2": "font/woff2",
    ".ttf":   "font/ttf",
    ".eot":   "application/vnd.ms-fontobject",
    ".map":   "application/json",
    ".txt":   "text/plain; charset=utf-8",
    ".xml":   "application/xml",
    ".webp":  "image/webp",
};

// ─── Livereload snippet injected before </body> ────────────────────────────────
const LIVERELOAD_SNIPPET = `<script data-bundlekit="livereload">
(function () {
  var sse = new EventSource('/__bundlekit_sse');
  sse.addEventListener('message', function (e) {
    if (e.data === 'reload') {
      console.log('[bundlekit] livereload triggered');
      location.reload();
    }
  });
  sse.onerror = function () {
    sse.close();
    setTimeout(function () { location.reload(); }, 2000);
  };
})();
</script>`;

// ─── Types ──────────────────────────────────────────────────────────────────────
export interface ProxyRule {
    /** 代理目标地址，如 "http://localhost:4000" */
    target: string;
    /** 是否改写 Host 头为目标地址，默认 true */
    changeOrigin?: boolean;
    /** 是否验证 HTTPS 证书，默认 false */
    secure?: boolean;
    /** 路径重写函数 */
    rewrite?: (reqPath: string) => string;
}

export interface DevServerOptions {
    host: string;
    port: number;
    /** 打包输出目录（静态文件根目录） */
    outDir: string;
    /** 是否自动打开浏览器 */
    open?: boolean;
    /** 代理配置 */
    proxy?: Record<string, string | ProxyRule>;
}

// ─── DevServer ──────────────────────────────────────────────────────────────────
export class DevServer {
    private server: http.Server | null = null;
    private sseClients = new Set<http.ServerResponse>();
    private options: DevServerOptions;
    private logger: Logger;

    constructor(options: DevServerOptions, logger: Logger) {
        this.options = options;
        this.logger = logger;
    }

    // ── Public API ──────────────────────────────────────────────────────────────

    /** 向所有已连接的浏览器客户端发送 reload 信号 */
    public reload(): void {
        const dead: http.ServerResponse[] = [];
        for (const client of this.sseClients) {
            try {
                client.write("data: reload\n\n");
            } catch {
                dead.push(client);
            }
        }
        dead.forEach((c) => this.sseClients.delete(c));
    }

    /** 启动 HTTP 服务 */
    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer(async (req, res) => {
                const url = req.url ?? "/";

                // 1. SSE livereload endpoint
                if (url.startsWith("/__bundlekit_sse")) {
                    res.writeHead(200, {
                        "Content-Type":  "text/event-stream",
                        "Cache-Control": "no-cache",
                        "Connection":    "keep-alive",
                        "Access-Control-Allow-Origin": "*",
                    });
                    res.write(":ok\n\n");
                    this.sseClients.add(res);
                    req.on("close", () => this.sseClients.delete(res));
                    return;
                }

                // 2. Proxy
                if (await this.handleProxy(req, res)) return;

                // 3. Static files
                const filePath = this.resolveFilePath(url);
                if (!filePath) {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end(`Cannot GET ${url}`);
                    return;
                }

                const ext  = path.extname(filePath).toLowerCase();
                const mime = MIME_TYPES[ext] ?? "application/octet-stream";
                try {
                    if (ext === ".html") {
                        // Inject livereload script
                        let html = readFileSync(filePath, "utf-8");
                        html = html.includes("</body>")
                            ? html.replace("</body>", `${LIVERELOAD_SNIPPET}\n</body>`)
                            : html + LIVERELOAD_SNIPPET;
                        res.writeHead(200, { "Content-Type": mime });
                        res.end(html);
                    } else {
                        const size = statSync(filePath).size;
                        res.writeHead(200, { "Content-Type": mime, "Content-Length": size });
                        createReadStream(filePath).pipe(res);
                    }
                } catch (err: any) {
                    this.logger.error(`[bundlekit] 读取文件失败: ${err.message}`);
                    res.writeHead(500);
                    res.end("Internal Server Error");
                }
            });

            this.server.on("error", reject);
            this.server.listen(this.options.port, this.options.host, () => {
                const addr = this.server!.address() as AddressInfo;
                const port = addr.port;
                const ip   = this.getLocalIP();

                this.logger.clearConsole("Dev Server 启动成功");
                this.logger.done("服务已启动:", "🌐");
                this.logger.log(`  - 本地:  http://localhost:${port}`);
                this.logger.log(`  - 网络:  http://${ip}:${port}`);
                this.logger.log("");

                if (this.options.open) this.openBrowser(`http://localhost:${port}`);
                resolve();
            });
        });
    }

    /** 关闭服务并断开所有 SSE 客户端 */
    public close(): void {
        for (const c of this.sseClients) { try { c.end(); } catch { /* ignore */ } }
        this.sseClients.clear();
        this.server?.close();
        this.server = null;
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    /** 把 URL 路径解析为实际文件路径，找不到返回 null，最终回退到 index.html（SPA） */
    private resolveFilePath(urlPath: string): string | null {
        let p = urlPath.split("?")[0];
        try { p = decodeURIComponent(p); } catch { /* ignore */ }

        const outDir    = this.options.outDir;
        const candidates = [
            path.join(outDir, p),
            path.join(outDir, p, "index.html"),
            path.join(outDir, "index.html"),          // SPA fallback
        ];

        for (const c of candidates) {
            try {
                if (statSync(c).isFile()) return c;
            } catch { /* ignore */ }
        }
        return null;
    }

    /** 尝试代理请求，匹配返回 true，未匹配返回 false */
    private async handleProxy(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<boolean> {
        const proxy  = this.options.proxy ?? {};
        const reqUrl = req.url ?? "/";

        for (const [prefix, rule] of Object.entries(proxy)) {
            if (!reqUrl.startsWith(prefix)) continue;

            const opts: ProxyRule = typeof rule === "string" ? { target: rule } : rule;
            let targetUrl: URL;
            try {
                targetUrl = new URL(opts.target);
            } catch {
                this.logger.error(`[bundlekit] 代理目标 URL 无效: ${opts.target}`);
                res.writeHead(502);
                res.end("Bad Gateway: invalid proxy target");
                return true;
            }

            const proxyPath  = opts.rewrite ? opts.rewrite(reqUrl) : reqUrl;
            const isHttps    = targetUrl.protocol === "https:";
            const requester  = isHttps ? https : http;
            const defaultPort = isHttps ? 443 : 80;

            return new Promise<boolean>((resolve) => {
                const proxyReq = requester.request(
                    {
                        hostname: targetUrl.hostname,
                        port:     Number(targetUrl.port) || defaultPort,
                        path:     proxyPath,
                        method:   req.method,
                        headers:  {
                            ...req.headers,
                            ...(opts.changeOrigin !== false ? { host: targetUrl.host } : {}),
                        },
                    },
                    (proxyRes) => {
                        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
                        proxyRes.pipe(res, { end: true });
                        resolve(true);
                    },
                );
                proxyReq.on("error", (err) => {
                    this.logger.error(`[bundlekit] 代理请求失败: ${err.message}`);
                    if (!res.headersSent) { res.writeHead(502); res.end(`Bad Gateway: ${err.message}`); }
                    resolve(true);
                });
                req.pipe(proxyReq, { end: true });
            });
        }

        return false;
    }

    /** 获取本机局域网 IPv4 地址 */
    private getLocalIP(): string {
        for (const list of Object.values(os.networkInterfaces())) {
            for (const info of list ?? []) {
                if (info.family === "IPv4" && !info.internal) return info.address;
            }
        }
        return "localhost";
    }

    private openBrowser(url: string): void {
        const cmd =
            process.platform === "darwin"  ? `open "${url}"` :
            process.platform === "win32"   ? `start "" "${url}"` :
                                             `xdg-open "${url}"`;
        exec(cmd, (err) => {
            if (err) this.logger.warn(`[bundlekit] 打开浏览器失败: ${err.message}`);
        });
    }
}
