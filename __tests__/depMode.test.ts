import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
    resolveDepMode,
    resolveDevkitDepValue,
    shortNameFromFullPkg,
    normalizeDeps,
    writeBundlerDevDep,
} from "../packages/bundlekit-cli/lib/utils/depMode";
import { DEP_MODE_ENV_KEYS } from "../packages/bundlekit-shared-utils/lib/types/cli-init";

function makeTmpDir(name: string): string {
    const dir = path.join(os.tmpdir(), `bundlekit-depMode-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

describe("shortNameFromFullPkg", () => {
    it("extracts short name from @bundlekit/* packages", () => {
        expect(shortNameFromFullPkg("@bundlekit/service")).toBe("service");
        expect(shortNameFromFullPkg("@bundlekit/plugin-react")).toBe("plugin-react");
        expect(shortNameFromFullPkg("@bundlekit/bundler-vite")).toBe("bundler-vite");
    });

    it("returns null for non-@bundlekit packages", () => {
        expect(shortNameFromFullPkg("react")).toBeNull();
        expect(shortNameFromFullPkg("@types/react")).toBeNull();
    });
});

describe("resolveDevkitDepValue", () => {
    it("returns ^version for known @bundlekit packages", () => {
        const v = resolveDevkitDepValue("plugin-react", {
            kind: "npm",
            cliVersion: "1.2.3",
        });
        // 现在读取真实版本号，格式应该是 ^x.y.z
        expect(v).toMatch(/^\^\d+\.\d+\.\d+$/);
    });
});

describe("resolveDepMode", () => {
    let savedEnvMode: string | undefined;

    beforeEach(() => {
        savedEnvMode = process.env[DEP_MODE_ENV_KEYS.MODE];
        delete process.env[DEP_MODE_ENV_KEYS.MODE];
    });

    afterEach(() => {
        if (savedEnvMode !== undefined) process.env[DEP_MODE_ENV_KEYS.MODE] = savedEnvMode;
        else delete process.env[DEP_MODE_ENV_KEYS.MODE];
    });

    it("always returns npm mode", () => {
        const mode = resolveDepMode("/any/path", "0.0.1");
        expect(mode.kind).toBe("npm");
        expect(mode.cliVersion).toBe("0.0.1");
    });

    it("ignores DEVKIT_DEP_MODE=link and returns npm mode", () => {
        process.env[DEP_MODE_ENV_KEYS.MODE] = "link";
        const mode = resolveDepMode("/any/path", "2.0.0");
        expect(mode.kind).toBe("npm");
        expect(mode.cliVersion).toBe("2.0.0");
    });
});

describe("normalizeDeps", () => {
    it("replaces workspace:^ with ^version", () => {
        const tmp = makeTmpDir("normalize-npm");
        try {
            fs.writeFileSync(
                path.join(tmp, "package.json"),
                JSON.stringify({
                    name: "demo",
                    devDependencies: {
                        "@bundlekit/service": "workspace:^",
                        "@bundlekit/bundler-vite": "workspace:^",
                    },
                }, null, 2),
            );
            normalizeDeps(tmp, { kind: "npm", cliVersion: "0.0.1" });
            const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf-8"));
            // 现在读取真实版本号，格式应该是 ^x.y.z
            expect(pkg.devDependencies["@bundlekit/service"]).toMatch(/^\^\d+\.\d+\.\d+$/);
            expect(pkg.devDependencies["@bundlekit/bundler-vite"]).toMatch(/^\^\d+\.\d+\.\d+$/);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("leaves zero workspace literals after normalize", () => {
        const tmp = makeTmpDir("normalize-zero-residue");
        try {
            fs.writeFileSync(
                path.join(tmp, "package.json"),
                JSON.stringify({
                    devDependencies: {
                        "@bundlekit/service": "workspace:^",
                        "@bundlekit/plugin-vue": "workspace:^",
                        "@bundlekit/bundler-rspack": "workspace:^",
                    },
                }, null, 2),
            );
            normalizeDeps(tmp, { kind: "npm", cliVersion: "0.0.1" });
            const text = fs.readFileSync(path.join(tmp, "package.json"), "utf-8");
            expect(text).not.toContain("workspace:");
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("writeBundlerDevDep", () => {
    it("writes ^version in npm mode", () => {
        const tmp = makeTmpDir("bundler-npm");
        try {
            fs.writeFileSync(
                path.join(tmp, "package.json"),
                JSON.stringify({ devDependencies: {} }, null, 2),
            );
            const [, val] = writeBundlerDevDep(tmp, "webpack", {
                kind: "npm",
                cliVersion: "1.5.0",
            });
            // 现在读取真实版本号，格式应该是 ^x.y.z
            expect(val).toMatch(/^\^\d+\.\d+\.\d+$/);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
