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
} from "../packages/devkit-cli/lib/utils/depMode";
import { DEP_MODE_ENV_KEYS } from "../packages/devkit-shared-utils/lib/types/cli-init";

function makeTmpDir(name: string): string {
    const dir = path.join(os.tmpdir(), `devkit-depMode-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

describe("shortNameFromFullPkg", () => {
    it("extracts short name from @devkit/* packages", () => {
        expect(shortNameFromFullPkg("@devkit/service")).toBe("service");
        expect(shortNameFromFullPkg("@devkit/plugin-react")).toBe("plugin-react");
        expect(shortNameFromFullPkg("@devkit/bundler-vite")).toBe("bundler-vite");
    });

    it("returns null for non-@devkit packages", () => {
        expect(shortNameFromFullPkg("react")).toBeNull();
        expect(shortNameFromFullPkg("@types/react")).toBeNull();
    });
});

describe("resolveDevkitDepValue", () => {
    it("returns ^cliVersion in npm mode", () => {
        const v = resolveDevkitDepValue("plugin-react", {
            kind: "npm",
            cliVersion: "1.2.3",
        });
        expect(v).toBe("^1.2.3");
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
    it("replaces workspace:^ with ^cliVersion", () => {
        const tmp = makeTmpDir("normalize-npm");
        try {
            fs.writeFileSync(
                path.join(tmp, "package.json"),
                JSON.stringify({
                    name: "demo",
                    devDependencies: {
                        "@devkit/service": "workspace:^",
                        "@devkit/bundler-vite": "workspace:^",
                    },
                }, null, 2),
            );
            normalizeDeps(tmp, { kind: "npm", cliVersion: "0.0.1" });
            const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf-8"));
            expect(pkg.devDependencies["@devkit/service"]).toBe("^0.0.1");
            expect(pkg.devDependencies["@devkit/bundler-vite"]).toBe("^0.0.1");
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
                        "@devkit/service": "workspace:^",
                        "@devkit/plugin-vue": "workspace:^",
                        "@devkit/bundler-rspack": "workspace:^",
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
    it("writes ^cliVersion in npm mode", () => {
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
            expect(val).toBe("^1.5.0");
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
