import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import {
    findMonorepoRoot,
    resolveDepMode,
    resolveDevkitDepValue,
    shortNameFromFullPkg,
    normalizeDeps,
    writeBundlerDevDep,
} from "../packages/devkit-cli/lib/utils/depMode";
import { DEP_MODE_ENV_KEYS } from "../packages/devkit-shared-utils/lib/types/cli-init";

const REPO_ROOT = path.resolve(__dirname, "..");

function makeTmpDir(name: string): string {
    const dir = path.join(os.tmpdir(), `devkit-depMode-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

describe("findMonorepoRoot", () => {
    it("finds the actual repo root from a nested directory", () => {
        const fromCli = findMonorepoRoot(path.join(REPO_ROOT, "packages/devkit-cli/lib"));
        expect(fromCli).toBe(REPO_ROOT);
    });

    it("finds the repo root when starting from repo root itself", () => {
        const root = findMonorepoRoot(REPO_ROOT);
        expect(root).toBe(REPO_ROOT);
    });

    it("returns null when not in a devkit monorepo", () => {
        const tmp = makeTmpDir("not-monorepo");
        try {
            expect(findMonorepoRoot(tmp)).toBeNull();
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("returns null even with pnpm-workspace.yaml but no devkit-service sentinel", () => {
        const tmp = makeTmpDir("ws-only");
        try {
            fs.writeFileSync(path.join(tmp, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
            fs.mkdirSync(path.join(tmp, "packages/some-other"), { recursive: true });
            expect(findMonorepoRoot(tmp)).toBeNull();
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

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
    it("returns link: URI in link mode", () => {
        const v = resolveDevkitDepValue("service", {
            kind: "link",
            monorepoRoot: "/abs/repo",
            cliVersion: "0.0.1",
        });
        expect(v).toBe("link:/abs/repo/packages/devkit-service");
    });

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
    let savedEnvRoot: string | undefined;

    beforeEach(() => {
        savedEnvMode = process.env[DEP_MODE_ENV_KEYS.MODE];
        savedEnvRoot = process.env[DEP_MODE_ENV_KEYS.MONOREPO_ROOT];
        delete process.env[DEP_MODE_ENV_KEYS.MODE];
        delete process.env[DEP_MODE_ENV_KEYS.MONOREPO_ROOT];
    });

    afterEach(() => {
        if (savedEnvMode !== undefined) process.env[DEP_MODE_ENV_KEYS.MODE] = savedEnvMode;
        else delete process.env[DEP_MODE_ENV_KEYS.MODE];
        if (savedEnvRoot !== undefined) process.env[DEP_MODE_ENV_KEYS.MONOREPO_ROOT] = savedEnvRoot;
        else delete process.env[DEP_MODE_ENV_KEYS.MONOREPO_ROOT];
    });

    it("auto-detects monorepo when cwd is inside it", () => {
        const mode = resolveDepMode(REPO_ROOT, "0.0.1");
        expect(mode.kind).toBe("link");
        expect(mode.monorepoRoot).toBe(REPO_ROOT);
        expect(mode.cliVersion).toBe("0.0.1");
    });

    it("returns npm when cwd is not in any monorepo", () => {
        const tmp = makeTmpDir("no-monorepo");
        try {
            const mode = resolveDepMode(tmp, "1.0.0");
            expect(mode.kind).toBe("npm");
            expect(mode.cliVersion).toBe("1.0.0");
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("respects DEVKIT_DEP_MODE=npm even inside monorepo", () => {
        process.env[DEP_MODE_ENV_KEYS.MODE] = "npm";
        const mode = resolveDepMode(REPO_ROOT, "2.0.0");
        expect(mode.kind).toBe("npm");
    });

    it("respects DEVKIT_DEP_MODE=link with explicit MONOREPO_ROOT", () => {
        process.env[DEP_MODE_ENV_KEYS.MODE] = "link";
        process.env[DEP_MODE_ENV_KEYS.MONOREPO_ROOT] = REPO_ROOT;
        const tmp = makeTmpDir("env-link");
        try {
            const mode = resolveDepMode(tmp, "0.0.1");
            expect(mode.kind).toBe("link");
            expect(mode.monorepoRoot).toBe(REPO_ROOT);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("normalizeDeps", () => {
    it("replaces workspace:^ with link: in link mode", () => {
        const tmp = makeTmpDir("normalize-link");
        try {
            fs.writeFileSync(
                path.join(tmp, "package.json"),
                JSON.stringify({
                    name: "demo",
                    devDependencies: {
                        "@devkit/service": "workspace:^",
                        "@devkit/plugin-react": "workspace:^",
                        "react": "^18.0.0",
                    },
                }, null, 2),
            );
            const result = normalizeDeps(tmp, {
                kind: "link",
                monorepoRoot: "/abs/repo",
                cliVersion: "0.0.1",
            });
            const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf-8"));
            expect(pkg.devDependencies["@devkit/service"]).toBe("link:/abs/repo/packages/devkit-service");
            expect(pkg.devDependencies["@devkit/plugin-react"]).toBe("link:/abs/repo/packages/devkit-plugin-react");
            expect(pkg.devDependencies.react).toBe("^18.0.0"); // 不动
            expect(result.replaced).toHaveLength(2);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it("replaces workspace:^ with ^cliVersion in npm mode", () => {
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
            normalizeDeps(tmp, { kind: "link", monorepoRoot: "/x", cliVersion: "0.0.1" });
            const text = fs.readFileSync(path.join(tmp, "package.json"), "utf-8");
            expect(text).not.toContain("workspace:");
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe("writeBundlerDevDep", () => {
    it("writes link: URI in link mode", () => {
        const tmp = makeTmpDir("bundler-link");
        try {
            fs.writeFileSync(
                path.join(tmp, "package.json"),
                JSON.stringify({ devDependencies: {} }, null, 2),
            );
            const [pkg, val] = writeBundlerDevDep(tmp, "vite", {
                kind: "link",
                monorepoRoot: "/abs/repo",
                cliVersion: "0.0.1",
            });
            expect(pkg).toBe("@devkit/bundler-vite");
            expect(val).toBe("link:/abs/repo/packages/devkit-bundler-vite");
            const written = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf-8"));
            expect(written.devDependencies["@devkit/bundler-vite"]).toBe("link:/abs/repo/packages/devkit-bundler-vite");
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

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
