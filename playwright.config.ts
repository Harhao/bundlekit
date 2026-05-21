import { defineConfig } from "@playwright/test";

/**
 * Playwright 配置
 *
 * 仅 Linux/macOS chromium，CI 用：
 *   pnpm playwright install --with-deps chromium
 */
export default defineConfig({
    testDir: "./__tests__/integration/e2e",
    timeout: 60_000,
    fullyParallel: false, // dev server 端口隔离不严，串行更稳
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? "list" : "list",
    use: {
        actionTimeout: 10_000,
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { browserName: "chromium" },
        },
    ],
});
