import { describe, it, expect } from "vitest";
import { validateBuildConfig } from "../packages/devkit-shared-utils/lib/shared/validate";
import type { IBuildConfig } from "../packages/devkit-shared-utils/lib/types/cli-service/config";
import type { IBuildEnv } from "../packages/devkit-shared-utils/lib/types/cli-service/env";

function makeConfig(envOverride: Record<string, any> = {}): IBuildConfig {
    return {
        mode: "development" as IBuildEnv,
        bundler: "webpack" as any,
        plugins: [],
        changeConfigure: (c: any) => c,
        config: {
            development: {
                publicPath: "/",
                entry: "src/index.ts",
                output: { dir: "dist", filename: "[name].js", formats: "umd" as any },
                externals: [],
                ...envOverride,
            },
        } as any,
    };
}

describe("validateBuildConfig", () => {
    it("returns valid for a complete config", () => {
        const result = validateBuildConfig(makeConfig(), "development");
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("returns invalid when config is null", () => {
        // @ts-expect-error intentional null for testing
        const result = validateBuildConfig(null, "development");
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("null check runs before envConfig access — no crash", () => {
        // Before the fix, null config would crash at config?.config?.[mode] line
        // After the fix, null check is first, returns cleanly
        // @ts-expect-error intentional null for testing
        expect(() => validateBuildConfig(null, "development")).not.toThrow();
    });

    it("returns invalid when entry is missing", () => {
        const result = validateBuildConfig(makeConfig({ entry: undefined }), "development");
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("entry"))).toBe(true);
    });

    it("returns invalid when output is missing", () => {
        const result = validateBuildConfig(makeConfig({ output: undefined }), "development");
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("output"))).toBe(true);
    });

    it("returns invalid when output.dir is missing", () => {
        const result = validateBuildConfig(makeConfig({ output: { filename: "[name].js", formats: "umd" } }), "development");
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("output.dir"))).toBe(true);
    });

    it("returns invalid when entry object is empty", () => {
        const result = validateBuildConfig(makeConfig({ entry: {} }), "development");
        expect(result.valid).toBe(false);
    });

    it("validates pages when present", () => {
        const result = validateBuildConfig(
            makeConfig({
                pages: [
                    { filename: "index.html", template: "index.html" },
                    { template: "about.html" }, // missing filename
                ],
            }),
            "development"
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("pages[1]"))).toBe(true);
    });
});
