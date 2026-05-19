import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

// Mock heavy dependencies before importing ConfigLoader
vi.mock("jiti", () => ({
    createJiti: () => (filePath: string) => {
        throw new Error(`No config file at ${filePath}`);
    },
}));
vi.mock("fs-extra", () => ({
    default: {
        existsSync: () => false,
        readFileSync: () => "",
        writeFileSync: () => {},
        mkdirSync: () => {},
        copyFileSync: () => {},
        ensureDirSync: () => {},
    },
    existsSync: () => false,
}));

import ConfigLoader from "../packages/devkit-service/lib/ConfigLoader";

const context = "/project/root";

function makeConfigLoader() {
    return new ConfigLoader(context, "development");
}

function callResolvePaths(loader: ConfigLoader, config: any): any {
    return (loader as any).resolvePaths(config);
}

describe("ConfigLoader.resolvePaths — string entry", () => {
    it("resolves relative string entry to absolute path", () => {
        const loader = makeConfigLoader();
        const resolved = callResolvePaths(loader, {
            config: {
                development: {
                    entry: "src/index.ts",
                    output: { dir: "dist", filename: "[name].js", formats: "umd" },
                    publicPath: "/",
                    externals: [],
                },
            },
        });
        expect(resolved.config.development.entry).toBe(path.resolve(context, "src/index.ts"));
    });

    it("leaves absolute entry unchanged", () => {
        const loader = makeConfigLoader();
        const absEntry = "/absolute/path/index.ts";
        const resolved = callResolvePaths(loader, {
            config: {
                development: {
                    entry: absEntry,
                    output: { dir: "dist", filename: "[name].js", formats: "umd" },
                    publicPath: "/",
                    externals: [],
                },
            },
        });
        expect(resolved.config.development.entry).toBe(absEntry);
    });
});

describe("ConfigLoader.resolvePaths — array entry (new behavior)", () => {
    it("resolves each element of an array entry", () => {
        const loader = makeConfigLoader();
        const resolved = callResolvePaths(loader, {
            config: {
                development: {
                    entry: ["src/main.ts", "src/polyfill.ts"],
                    output: { dir: "dist", filename: "[name].js", formats: "umd" },
                    publicPath: "/",
                    externals: [],
                },
            },
        });
        const entry = resolved.config.development.entry as string[];
        expect(entry[0]).toBe(path.resolve(context, "src/main.ts"));
        expect(entry[1]).toBe(path.resolve(context, "src/polyfill.ts"));
    });
});

describe("ConfigLoader.resolvePaths — object entry (new behavior)", () => {
    it("resolves each value of an object entry map", () => {
        const loader = makeConfigLoader();
        const resolved = callResolvePaths(loader, {
            config: {
                development: {
                    entry: { main: "src/main.ts", worker: "src/worker.ts" },
                    output: { dir: "dist", filename: "[name].js", formats: "umd" },
                    publicPath: "/",
                    externals: [],
                },
            },
        });
        const entry = resolved.config.development.entry as Record<string, string>;
        expect(entry.main).toBe(path.resolve(context, "src/main.ts"));
        expect(entry.worker).toBe(path.resolve(context, "src/worker.ts"));
    });
});

describe("ConfigLoader.resolvePaths — output and alias", () => {
    it("resolves output.dir", () => {
        const loader = makeConfigLoader();
        const resolved = callResolvePaths(loader, {
            config: {
                development: {
                    entry: "src/index.ts",
                    output: { dir: "dist", filename: "[name].js", formats: "umd" },
                    publicPath: "/",
                    externals: [],
                },
            },
        });
        const output = resolved.config.development.output;
        expect(output.dir).toBe(path.resolve(context, "dist"));
    });

    it("resolves alias values", () => {
        const loader = makeConfigLoader();
        const resolved = callResolvePaths(loader, {
            config: {
                development: {
                    entry: "src/index.ts",
                    output: { dir: "dist", filename: "[name].js", formats: "umd" },
                    publicPath: "/",
                    externals: [],
                    alias: { "@": "src", components: "src/components" },
                },
            },
        });
        const alias = resolved.config.development.alias;
        expect(alias["@"]).toBe(path.resolve(context, "src"));
        expect(alias.components).toBe(path.resolve(context, "src/components"));
    });
});
