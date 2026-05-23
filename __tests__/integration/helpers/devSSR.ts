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
 * 断言 dev SSR HTTP 行为：GET / 返回 200 + SSR_MARKER 在 HTML 中
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
    } finally {
        await session.close();
    }
}
