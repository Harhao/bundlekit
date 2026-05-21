import { defineConfig } from "vitest/config";

/**
 * 集成测试 vitest 配置
 *
 * 与单元测试 (vitest.config 默认) 隔离：
 *   - testTimeout 60s（单元测试默认 5s 不够 build 跑完）
 *   - hookTimeout 60s（fixture 复制 / install 也算 hook）
 *   - pool='forks' 子进程隔离，避免 watcher 文件句柄泄漏到 next test
 *   - maxConcurrency=2 限制并行子进程数，CI 内存友好
 *   - include 仅 __tests__/integration/ 下的 .test.ts
 *   - exclude 默认 __tests__/ 根目录的单元测试
 */
export default defineConfig({
    test: {
        include: ["__tests__/integration/**/*.test.ts"],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/__tests__/integration/fixtures/**",
        ],
        testTimeout: 60_000,
        hookTimeout: 60_000,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: false,
                maxForks: 2,
                minForks: 1,
            },
        },
        maxConcurrency: 2,
        reporters: ["verbose"],
    },
});
