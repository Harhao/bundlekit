import { copyFixture, installInFixture } from "./fixture";
import { spawnService, ISpawnedService } from "./spawnService";
import { fetchSSR, waitUntilHttp } from "./fetch";
import { getFreePort } from "./port";

export interface IDevSPASession {
    /** fixture 临时目录 */
    dir: string;
    /** 子进程句柄 */
    service: ISpawnedService;
    /** 端口 */
    port: number;
    /** 关闭并清理 */
    close: () => Promise<void>;
}

/**
 * 启动一个 fixture 的 dev SPA 子进程（无 SSR，仅 CSR + dev server）。
 *
 * 与 startDevSSR 的区别：
 *   - 用 .bundlekitrc.dev-spa.ts（无 ssr 块）
 *   - 不依赖 createSSRMiddleware，仅起标准 dev server
 *   - GET / 返回 dev server 注入了 <script> 标签的 HTML（无服务端渲染内容）
 */
export async function startDevSPA(bundler: string): Promise<IDevSPASession> {
    const handle = await copyFixture(bundler, "dev-spa");
    try {
        installInFixture(handle.dir);

        const port = await getFreePort();

        // 不所有 bundler 都打印同一个 ready log（vite "Local:"、webpack "compiled
        // successfully"、rspack 同 webpack、rollup "服务已启动"、parcel "Server running"
        // 等），与其维护一个易过时的兼容正则，不如直接靠 waitUntilHttp 兜底确认
        // server 真正可达。spawnService 不传 waitForLog 即立刻 resolve，避免跨
        // bundler 维护成本。
        const service = await spawnService({
            cwd: handle.dir,
            args: [
                "serve",
                "--mode",
                "development",
                "--port",
                String(port),
                "--host",
                "127.0.0.1",
            ],
            timeout: 60_000,
        });

        await waitUntilHttp(port, "/", 60_000);

        return {
            dir: handle.dir,
            service,
            port,
            close: async () => {
                try {
                    await service.kill();
                } finally {
                    await handle.cleanup();
                }
            },
        };
    } catch (e) {
        await handle.cleanup();
        throw e;
    }
}

/**
 * 断言 dev SPA HTTP 行为：
 *   1. GET / 返回 200
 *   2. body 是 HTML（含 <html / <body 标签 或者 <!DOCTYPE）
 *   3. body 含挂载点（#app-root 或 #root，与 fixture index.html 对齐）
 *   4. body 含至少一个 <script src=...>（dev server 注入了 client bundle 入口）
 *   5. 该 script URL 在同一 server 上能 200 拿到 JS（client bundle 可下载）
 *
 * 这五步覆盖你提到的 5 个真实失败：
 *   - webpack/rspack/rollup 起不来 → 第 1 步直接 timeout
 *   - bundle 下载失败 → 第 5 步 status≠200
 *   - 入口注入丢失 → 第 4 步无 <script>
 *   - 模板未渲染 → 第 3 步缺 #app-root
 */
export async function assertDevSPA(bundler: string): Promise<void> {
    const session = await startDevSPA(bundler);
    try {
        // 显式声明 Accept: text/html — 浏览器默认行为；vite-plugin-html 等
        // history-fallback 中间件仅在 HTML accept header 下生效
        const r = await fetchSSR(session.port, "/", {
            headers: { Accept: "text/html" },
        });
        if (r.status !== 200) {
            throw new Error(
                `${bundler} dev SPA: GET / status=${r.status}\nbody[0..500]: ${r.text.slice(0, 500)}\n` +
                `service.stdout: ${session.service.stdout()}\n` +
                `service.stderr: ${session.service.stderr()}`,
            );
        }

        // 1) HTML 文档结构
        const looksLikeHtml =
            /<!DOCTYPE/i.test(r.text) || /<html\b/i.test(r.text) || /<body\b/i.test(r.text);
        if (!looksLikeHtml) {
            throw new Error(
                `${bundler} dev SPA: response 不像 HTML\nbody[0..500]: ${r.text.slice(0, 500)}`,
            );
        }

        // 2) 挂载点存在（fixtures/shared/public/index.html 的 #app-root）
        if (!/id\s*=\s*["']app-root["']|id\s*=\s*["']root["']/i.test(r.text)) {
            throw new Error(
                `${bundler} dev SPA: response 缺少挂载点 (#app-root / #root)\nbody[0..500]: ${r.text.slice(0, 500)}`,
            );
        }

        // 3) <script src=...> 注入校验
        const scriptMatches = Array.from(
            r.text.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),
        );
        if (scriptMatches.length === 0) {
            throw new Error(
                `${bundler} dev SPA: response 没有任何 <script src=...>，dev server 未注入入口\n` +
                `body[0..800]: ${r.text.slice(0, 800)}`,
            );
        }

        // 4) 第一个 script URL 必须能被 dev server 服务到
        let firstSrc = scriptMatches[0][1];
        if (!/^https?:\/\//.test(firstSrc)) {
            if (!firstSrc.startsWith("/")) firstSrc = "/" + firstSrc;
            const scriptRes = await fetchSSR(session.port, firstSrc);
            if (scriptRes.status !== 200) {
                throw new Error(
                    `${bundler} dev SPA: client script ${firstSrc} returned status=${scriptRes.status}\n` +
                    `response body[0..200]: ${scriptRes.text.slice(0, 200)}`,
                );
            }
            // bundle 内容简单合理性检查：非空、不是 HTML 错误页
            if (scriptRes.text.length < 50) {
                throw new Error(
                    `${bundler} dev SPA: client bundle 内容过短 (${scriptRes.text.length} bytes)，可能是错误页`,
                );
            }
            if (/<!DOCTYPE\s+html|<html\b/i.test(scriptRes.text)) {
                throw new Error(
                    `${bundler} dev SPA: client bundle 路由 ${firstSrc} 命中了 HTML（dev server 把脚本路径 fallback 到了 index.html）`,
                );
            }
        }
    } finally {
        await session.close();
    }
}
