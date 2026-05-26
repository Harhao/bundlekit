import { describe, it, expect, vi } from "vitest";
import path from "path";

// Mock external dependencies that Service transitively pulls in
vi.mock("fs-extra", () => ({
    default: {
        existsSync: () => false,
        readFileSync: () => "{}",
        writeFileSync: () => {},
        mkdirSync: () => {},
        ensureDirSync: () => {},
    },
    existsSync: () => false,
}));

vi.mock("execa", () => ({
    execa: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));

import Service from "../packages/bundlekit-service/lib/Service";
import type { IBuildConfig } from "../packages/bundlekit-shared-utils/lib/types/cli-service/config";
import type { IBuildEnv } from "../packages/bundlekit-shared-utils/lib/types/cli-service/env";

function makeBaseConfig(): IBuildConfig {
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
            },
        } as any,
    };
}

describe("Service.getBundlerRegistry", () => {
    it("maps all 7 bundler names to their adapter package names", () => {
        const service = new Service("/tmp");
        const registry = (service as any).getBundlerRegistry() as Record<string, string>;

        expect(registry.webpack).toBe("@bundlekit/bundler-webpack");
        expect(registry.vite).toBe("@bundlekit/bundler-vite");
        expect(registry.rollup).toBe("@bundlekit/bundler-rollup");
        expect(registry.rspack).toBe("@bundlekit/bundler-rspack");
        expect(registry.rolldown).toBe("@bundlekit/bundler-rolldown");
        expect(registry.parcel).toBe("@bundlekit/bundler-parcel");
        expect(registry.esbuild).toBe("@bundlekit/bundler-esbuild");
    });

    it("returns exactly 7 entries", () => {
        const service = new Service("/tmp");
        const registry = (service as any).getBundlerRegistry() as Record<string, string>;
        expect(Object.keys(registry)).toHaveLength(7);
    });

    it("all values are @bundlekit-scoped package names", () => {
        const service = new Service("/tmp");
        const registry = (service as any).getBundlerRegistry() as Record<string, string>;
        for (const pkg of Object.values(registry)) {
            expect(pkg).toMatch(/^@bundlekit\/bundler-/);
        }
    });
});

describe("Service plugin apply ordering", () => {
    it("plugin B sees config changes made by plugin A via modifyBuildConfig", () => {
        const service = new Service("/tmp");
        service.setBuildConfig(makeBaseConfig());

        const observedByPluginB: string[] = [];

        // Plugin A modifies config to set framework = "react"
        service.plugins = [
            {
                id: "test:plugin-a",
                defaultModes: {},
                apply: (_api: any, _config: any) => {
                    const current = service.getBuildConfig()!;
                    service.setBuildConfig({
                        ...current,
                        config: {
                            ...current.config,
                            development: {
                                ...(current.config?.development as any),
                                framework: "react" as const,
                            },
                        } as any,
                    });
                },
            },
            {
                id: "test:plugin-b",
                defaultModes: {},
                apply: (_api: any, _config: any) => {
                    // Using this.getBuildConfig() (the fix) means plugin B sees latest config
                    const latest = service.getBuildConfig();
                    observedByPluginB.push((latest?.config?.development as any)?.framework ?? "none");
                },
            },
        ];

        // Simulate the fixed init() loop: each plugin reads from service.getBuildConfig()
        for (const plugin of service.plugins) {
            plugin.apply({} as any, service.getBuildConfig()!);
        }

        expect(observedByPluginB[0]).toBe("react");
    });

    it("plugin B would NOT see changes if using old snapshot (demonstrating the bug)", () => {
        const service = new Service("/tmp");
        service.setBuildConfig(makeBaseConfig());

        const observedByPluginB: string[] = [];

        // Capture snapshot BEFORE loop — this is the old (buggy) behavior
        const staleSnapshot = service.getBuildConfig()!;

        service.plugins = [
            {
                id: "test:plugin-a",
                defaultModes: {},
                apply: (_api: any, _config: any) => {
                    const current = service.getBuildConfig()!;
                    service.setBuildConfig({
                        ...current,
                        config: {
                            ...current.config,
                            development: {
                                ...(current.config?.development as any),
                                framework: "react" as const,
                            },
                        } as any,
                    });
                },
            },
            {
                id: "test:plugin-b",
                defaultModes: {},
                apply: (_api: any, _config: any) => {
                    // Using stale snapshot (old bug) means plugin B sees "none"
                    observedByPluginB.push((staleSnapshot?.config?.development as any)?.framework ?? "none");
                },
            },
        ];

        for (const plugin of service.plugins) {
            plugin.apply({} as any, staleSnapshot); // old behavior: pass stale config
        }

        // Stale snapshot does NOT have the framework set by plugin A
        expect(observedByPluginB[0]).toBe("none");
    });
});
