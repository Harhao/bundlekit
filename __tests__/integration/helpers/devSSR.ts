import { copyFixture, installInFixture, FixtureMode } from "./fixture";
import { spawnService, ISpawnedService } from "./spawnService";
import { fetchSSR, waitUntilHttp } from "./fetch";
import { getFreePort } from "./port";

export interface IDevSSRSession {
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
 * 启动一个 fixture 的 dev SSR 子进程，返回 session 句柄。
 *
 * 测试结束必须调 close()，否则会留 orphan 进程。
 */
export async function startDevSSR(bundler: string): Promise<IDevSSRSession> {
    const handle = await copyFixture(bundler, "ssr");
    try {
        installInFixture(handle.dir);

        const port = await getFreePort();

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
            // service 启动后会 logger.done(... SSR dev server 就绪)
            waitForLog: /SSR dev server 就绪|SSR dev server ready|listening on/i,
            timeout: 60_000,
        });

        // 等 HTTP 实际可达（waitForLog 已 ready 但 server 可能还在最后绑定）
        await waitUntilHttp(port, "/", 30_000);

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
 * 断言 dev SSR HTTP 行为：
 *   1. GET / 返回 200
 *   2. body 包含 SSR_MARKER（SSR 渲染生效）
 *   3. body 含至少一个 <script src=...>（hydration 入口已注入）
 *   4. 该 script URL 在同一 server 上能 200 拿到 JS（client bundle 可下载）
 *
 * 第 3、4 步是本次修复的核心验证：之前页面能渲染但事件不绑就是因为缺 client script。
 */
export async function assertDevSSR(bundler: string): Promise<void> {
    const session = await startDevSSR(bundler);
    try {
        const r = await fetchSSR(session.port, "/");
        if (r.status !== 200) {
            throw new Error(
                `${bundler} dev SSR: GET / status=${r.status}\nbody: ${r.text.slice(0, 500)}\n` +
                `service.stdout: ${session.service.stdout()}\n` +
                `service.stderr: ${session.service.stderr()}`,
            );
        }
        if (!r.text.includes("__SSR_MARKER__")) {
            throw new Error(
                `${bundler} dev SSR: response missing __SSR_MARKER__\nbody: ${r.text.slice(0, 500)}`,
            );
        }
        // ── Hydration script tag 验证 ──────────────────────────────────────────
        const scriptMatches = Array.from(
            r.text.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi),
        );
        if (scriptMatches.length === 0) {
            throw new Error(
                `${bundler} dev SSR: response has no <script src=...> for hydration\nbody: ${r.text.slice(0, 800)}`,
            );
        }
        // 取第一个 script，fetch 验证它能被 server 服务到（实际能 hydrate 的前提）
        let firstSrc = scriptMatches[0][1];
        // 跳过外部 http(s) 资源（一般不会出现，但 defensive）
        if (!/^https?:\/\//.test(firstSrc)) {
            // 确保以 / 开头
            if (!firstSrc.startsWith("/")) firstSrc = "/" + firstSrc;
            const scriptRes = await fetchSSR(session.port, firstSrc);
            if (scriptRes.status !== 200) {
                throw new Error(
                    `${bundler} dev SSR: client script ${firstSrc} returned status=${scriptRes.status}\n` +
                    `response body[0..200]: ${scriptRes.text.slice(0, 200)}`,
                );
            }
        }
    } finally {
        await session.close();
    }
}
