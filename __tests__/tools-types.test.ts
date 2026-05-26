import { describe, it } from "vitest";
import type { IBuildConfig, IToolsCtx } from "../packages/bundlekit-shared-utils/lib/types/cli-service/config";

describe("tools type inference", () => {
    it("compile-time only: tools.webpack receives webpack Configuration", () => {
        const config: IBuildConfig = {
            mode: "development",
            bundler: "webpack",
            plugins: [],
            changeConfigure: (c) => c,
            tools: {
                webpack(config, ctx) {
                    // 类型断言（编译期）
                    const _mode: typeof ctx.mode = "production";
                    const _command: typeof ctx.command = "build";
                    const _env: typeof ctx.env = "client";
                    const _bundler: typeof ctx.bundler = "webpack";
                    // config 应该是 webpack Configuration 类型
                    void config.entry;
                    void config.output;
                },
                vite(config, ctx) {
                    // config 应该是 vite InlineConfig
                    void config.plugins;
                    void config.server;
                },
                rspack(config, ctx) {
                    void config.entry;
                    void config.module;
                },
                rollup(config, ctx) {
                    void config.input;
                    void config.output;
                },
                rolldown(config, ctx) {
                    // rolldown 类型为 unknown，需用户自己断言
                    void (config as any).input;
                },
                parcel(config, ctx) {
                    // parcel 类型为 unknown，需用户自己断言
                    void (config as any).entries;
                },
                esbuild(config, ctx) {
                    // esbuild 类型为 unknown，需用户自己断言
                    void (config as any).entryPoints;
                },
            },
            config: {
                development: {
                    target: "web",
                    publicPath: "/",
                    entry: "src/index.ts",
                    output: { dir: "dist", filename: "[name].js", formats: "umd" },
                    alias: {},
                    externals: [],
                },
            },
        };
        // 该断言只为防止 vitest 优化掉
        void config;
    });

    it("ToolsCtx fields shape", () => {
        const ctx: IToolsCtx = {
            mode: "production",
            command: "build",
            env: "client",
            bundler: "webpack",
        };
        void ctx;
    });
});
