import { createCliFixture, ICliFixtureOptions, ICliFixtureHandle } from "./cliFixture";
import { spawnService, ISpawnedService } from "./spawnService";
import { fetchSSR, waitUntilHttp } from "./fetch";
import { getFreePort } from "./port";

export interface IDevSmokeOptions extends ICliFixtureOptions {
    /** 启动后等待 dev server 可达的最大毫秒数（默认 90s） */
    httpTimeout?: number;
}

export interface IDevSmokeSession {
    fixture: ICliFixtureHandle;
    service: ISpawnedService;
    port: number;
    close: () => Promise<void>;
}

/**
 * 用 cli create + link: + pnpm install + spawnService 起一个 dev 环境。
 * SSR / CSR 由 opts.ssr 控制。
 */
export async function startDevSmoke(opts: IDevSmokeOptions): Promise<IDevSmokeSession> {
    const fixture = await createCliFixture(opts);
    try {
        const port = await getFreePort();
        const service = await spawnService({
            cwd: fixture.dir,
            args: [
                "serve",
                "--mode",
                "development",
                "--port",
                String(port),
                "--host",
                "127.0.0.1",
            ],
            timeout: opts.httpTimeout ?? 90_000,
        });

        await waitUntilHttp(port, "/", opts.httpTimeout ?? 90_000);

        return {
            fixture,
            service,
            port,
            close: async () => {
                try {
                    await service.kill();
                } finally {
                    await fixture.cleanup();
                }
            },
        };
    } catch (e) {
        await fixture.cleanup();
        throw e;
    }
}

/**
 * 端到端 dev/SSR HTTP 烟雾测试：
 *   1. cli create 生成真实模板项目
 *   2. install + spawn dev server
 *   3. GET /（带 Accept: text/html）→ 200
 *   4. body 是 HTML（含 DOCTYPE / html / body）
 *   5. body 含项目挂载点（#root / #app-root / #app）
 *   6. body 含至少一个 <script src=...> 注入入口
 *   7. SSR 模式额外校验：body 含 `Hello, ${projectName}!`（模板中 SSR 渲染的实文本）
 *   8. 第一个 <script src> 在同一 server 上能 200 拿到 JS bundle
 *
 * 这套断言能直接拦下你之前 5 个真实失败：
 *   - webpack/rspack/rollup 起不来 → 第 2/3 步 timeout
 *   - 模板渲染失败（ts-loader 缺 typescript / vue-loader 缺 NormalModule）
 *     → service 子进程 exit 非零 → spawnService throw
 *   - 入口注入丢失 → 第 6 步无 <script>
 *   - bundle 下载失败 → 第 8 步 status≠200
 *   - SSR 渲染没生效 → 第 7 步缺文案
 */
export async function assertDevSmoke(opts: IDevSmokeOptions): Promise<void> {
    const projectName = opts.projectName || "demo-smoke";
    const session = await startDevSmoke({ ...opts, projectName });
    const tag = `${opts.template}/${opts.bundler}${opts.ssr ? "/ssr" : ""}`;

    try {
        const r = await fetchSSR(session.port, "/", {
            headers: { Accept: "text/html" },
        });

        if (r.status !== 200) {
            throw new Error(
                `[${tag}] GET / status=${r.status}\nbody[0..600]: ${r.text.slice(0, 600)}\n` +
                `service.stdout: ${session.service.stdout()}\n` +
                `service.stderr: ${session.service.stderr()}`,
            );
        }

        // 1) HTML 文档结构
        const looksLikeHtml =
            /<!DOCTYPE/i.test(r.text) || /<html\b/i.test(r.text) || /<body\b/i.test(r.text);
        if (!looksLikeHtml) {
            throw new Error(
                `[${tag}] response 不像 HTML\nbody[0..600]: ${r.text.slice(0, 600)}`,
            );
        }

        // 2) 挂载点（不同模板挂载点不同：react #root / vue #app / 我们 fixture #app-root）
        if (!/id\s*=\s*["'](?:root|app|app-root)["']/i.test(r.text)) {
            throw new Error(
                `[${tag}] response 缺少挂载点 (#root / #app / #app-root)\nbody[0..600]: ${r.text.slice(0, 600)}`,
            );
        }

        // 3) <script src> 注入
        const scriptMatches = Array.from(
            r.text.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),
        );
        if (scriptMatches.length === 0) {
            throw new Error(
                `[${tag}] response 没有任何 <script src=...>，dev server 未注入入口\n` +
                `body[0..800]: ${r.text.slice(0, 800)}`,
            );
        }

        // 4) SSR 模式：body 必须含模板渲染出的文案
        if (opts.ssr) {
            const expected = `Hello, ${projectName}!`;
            if (!r.text.includes(expected)) {
                throw new Error(
                    `[${tag}] SSR response 缺少渲染文案 "${expected}"\nbody[0..800]: ${r.text.slice(0, 800)}`,
                );
            }
        }

        // 5) 第一个 client script URL 必须能被 dev server 200 服务
        let firstSrc = scriptMatches[0][1];
        // 过滤掉 vite-specific 的 /@vite/client 与 /@react-refresh —— 这些是 dev runtime
        // 注入，不是用户入口；找第一个非框架内部脚本
        const userScript = scriptMatches.find(([, src]) => !/^\/?@(vite|react-refresh)/i.test(src));
        if (userScript) firstSrc = userScript[1];

        if (!/^https?:\/\//.test(firstSrc)) {
            if (!firstSrc.startsWith("/")) firstSrc = "/" + firstSrc;
            const scriptRes = await fetchSSR(session.port, firstSrc);
            if (scriptRes.status !== 200) {
                throw new Error(
                    `[${tag}] client script ${firstSrc} returned status=${scriptRes.status}\n` +
                    `response body[0..200]: ${scriptRes.text.slice(0, 200)}`,
                );
            }
            if (scriptRes.text.length < 50) {
                throw new Error(
                    `[${tag}] client bundle 内容过短 (${scriptRes.text.length} bytes)，可能是错误页`,
                );
            }
            if (/<!DOCTYPE\s+html|<html\b/i.test(scriptRes.text)) {
                throw new Error(
                    `[${tag}] client bundle 路由 ${firstSrc} 命中了 HTML（dev server 错误 fallback）`,
                );
            }
        }
    } finally {
        await session.close();
    }
}
