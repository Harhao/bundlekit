/**
 * 简单 HTTP fetch helper（基于 node 原生 fetch，要求 Node ≥ 18）
 *
 * 集成测试用：起 dev server → fetchSSR(port, '/') 拿响应 → 断言。
 */

export interface ISSRFetchResult {
    status: number;
    text: string;
    headers: Headers;
}

export async function fetchSSR(
    port: number,
    pathname: string = "/",
    init?: RequestInit,
): Promise<ISSRFetchResult> {
    const res = await fetch(`http://127.0.0.1:${port}${pathname}`, init);
    const text = await res.text();
    return {
        status: res.status,
        text,
        headers: res.headers,
    };
}

/**
 * 等待端口上有 HTTP 响应（最多 timeout ms）
 *
 * 用于 spawnService 没有可靠 ready log 时的兜底
 */
export async function waitUntilHttp(
    port: number,
    pathname: string = "/",
    timeout: number = 30_000,
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const r = await fetch(`http://127.0.0.1:${port}${pathname}`);
            if (r.status > 0) return;
        } catch {
            // ignore
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`waitUntilHttp port=${port} path=${pathname} timeout`);
}
