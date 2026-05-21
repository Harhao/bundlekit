import { test, expect, Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import { startDevSSR } from "../helpers/devSSR";

/**
 * 通用 HMR 验证：编辑 fixture 中的 App.tsx，断言页面无刷新地更新。
 *
 * 注意：使用 startDevSSR + Playwright 时 fixture 已经被复制到 .tmp 目录，
 * 所以编辑的是 .tmp 副本（测试结束清理）。
 */
export async function assertClientHMR(bundler: string, page: Page): Promise<void> {
    const session = await startDevSSR(bundler);
    try {
        // 注入计数器：每次 navigation 自增（HMR 不算 navigation）
        await page.addInitScript(() => {
            (window as any).__navigationCount = ((window as any).__navigationCount || 0) + 1;
        });
        await page.goto(`http://127.0.0.1:${session.port}/`, { waitUntil: "domcontentloaded" });
        // 等待 hydrate（react 渲染）：text 出现即可
        await page.waitForSelector('[data-testid="title"]', { timeout: 15_000 });
        const initial = await page.locator('[data-testid="title"]').textContent();
        expect(initial).toContain("__SSR_MARKER__");

        // 编辑 .tmp 内的 App.tsx
        const appFile = path.resolve(session.dir, "shared/src/App.tsx");
        const original = await fs.readFile(appFile, "utf-8");
        const modified = original.replace("__SSR_MARKER__ Hello DevKit", "__SSR_MARKER__ HMR Updated");

        try {
            await fs.writeFile(appFile, modified);
            // 等内容更新（最多 15s）。HMR 链路即可，未集成 React Fast Refresh 时 full reload 也算工作
            await expect(page.locator('[data-testid="title"]')).toHaveText(/HMR Updated/, { timeout: 15_000 });
        } finally {
            await fs.writeFile(appFile, original);
        }
    } finally {
        await session.close();
    }
}
