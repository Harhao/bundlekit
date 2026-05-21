import { defineConfig } from "vitest/config";

/**
 * 默认（单元）vitest 配置
 *
 * 排除 __tests__/integration/ 子树（由 vitest.integration.config.ts 单独管理）。
 */
export default defineConfig({
    test: {
        include: ["__tests__/**/*.test.ts"],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "__tests__/integration/**",
        ],
    },
});
