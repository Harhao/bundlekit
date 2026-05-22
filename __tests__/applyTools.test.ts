import { describe, it, expect, vi } from "vitest";
import { applyTools } from "../packages/bundlekit-service/lib/utils/applyTools";
import type { IBuildConfig, IToolsCtx } from "../packages/bundlekit-shared-utils/lib/types/cli-service/config";

const baseCtx: IToolsCtx = {
    mode: "production",
    command: "build",
    env: "client",
    bundler: "webpack",
};

function makeConfig(tools: any): IBuildConfig {
    return {
        mode: "production",
        bundler: "webpack",
        plugins: [],
        changeConfigure: (c) => c,
        tools,
        config: {},
    };
}

describe("applyTools", () => {
    it("returns rawConfig unchanged when no tools field", async () => {
        const buildConfig = makeConfig(undefined);
        const raw = { entry: "./src/index.ts" };
        const result = await applyTools(buildConfig, "webpack", raw, baseCtx);
        expect(result).toBe(raw);
    });

    it("returns rawConfig when bundler hook is missing", async () => {
        const buildConfig = makeConfig({ vite: () => {} });
        const raw = { entry: "./src/index.ts" };
        const result = await applyTools(buildConfig, "webpack", raw, baseCtx);
        expect(result).toBe(raw);
    });

    it("uses mutated config when hook returns undefined", async () => {
        const hook = vi.fn((config: any) => {
            config.touched = true;
        });
        const buildConfig = makeConfig({ webpack: hook });
        const raw: any = { entry: "./src/index.ts" };
        const result = await applyTools(buildConfig, "webpack", raw, baseCtx);
        expect(hook).toHaveBeenCalledTimes(1);
        expect(result).toBe(raw);
        expect((result as any).touched).toBe(true);
    });

    it("replaces config when hook returns a new object", async () => {
        const replacement = { entry: "./src/replaced.ts" };
        const buildConfig = makeConfig({ webpack: () => replacement });
        const raw = { entry: "./src/index.ts" };
        const result = await applyTools(buildConfig, "webpack", raw, baseCtx);
        expect(result).toBe(replacement);
    });

    it("awaits async hook return value", async () => {
        const replacement = { foo: 1 };
        const buildConfig = makeConfig({
            webpack: async () => {
                await new Promise((r) => setTimeout(r, 1));
                return replacement;
            },
        });
        const result = await applyTools(buildConfig, "webpack", { foo: 0 }, baseCtx);
        expect(result).toBe(replacement);
    });

    it("propagates hook errors (no swallow)", async () => {
        const buildConfig = makeConfig({
            webpack: () => {
                throw new Error("bad hook");
            },
        });
        await expect(applyTools(buildConfig, "webpack", {}, baseCtx)).rejects.toThrow(
            "bad hook",
        );
    });

    it("propagates async hook rejection", async () => {
        const buildConfig = makeConfig({
            webpack: async () => {
                throw new Error("async bad");
            },
        });
        await expect(applyTools(buildConfig, "webpack", {}, baseCtx)).rejects.toThrow(
            "async bad",
        );
    });

    it("passes ctx through to hook", async () => {
        const hook = vi.fn();
        const buildConfig = makeConfig({ vite: hook });
        const ctx: IToolsCtx = { mode: "test", command: "serve", env: "server", bundler: "vite" };
        await applyTools(buildConfig, "vite", { plugins: [] }, ctx);
        expect(hook).toHaveBeenCalledWith({ plugins: [] }, ctx);
    });
});
