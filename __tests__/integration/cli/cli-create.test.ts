import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { spawnSync } from "node:child_process";

/**
 * cli-create 集成测试
 *
 * 验证 cli 创建项目时生成的 package.json 是否正确：
 *   - 始终使用 npm registry 模式（^cliVersion），不含 workspace:^
 */

const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLI_BIN = path.resolve(REPO_ROOT, "packages/bundlekit-cli/dist/index.mjs");

async function makeTmpCwd(label: string): Promise<{ cwd: string; cleanup: () => Promise<void> }> {
    const cwd = path.join(REPO_ROOT, "__tests__/integration/.tmp", `cli-create-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    await fs.mkdir(cwd, { recursive: true });
    return {
        cwd,
        cleanup: async () => {
            try { await fs.rm(cwd, { recursive: true, force: true }); } catch {}
        },
    };
}

function runCreate(opts: {
    cwd: string;
    name: string;
    template: string;
    bundler: string;
    env?: Record<string, string>;
}): { code: number; stdout: string; stderr: string } {
    const result = spawnSync(
        "node",
        [CLI_BIN, "create", opts.name, "-t", opts.template, "-b", opts.bundler, "-d", "test", "--pm", "pnpm"],
        {
            cwd: opts.cwd,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
                ...process.env,
                DEVKIT_NO_INK: "1",   // 走 legacy enquirer 路径，方便端到端
                DEVKIT_QUIET: "0",
                DEVKIT_SKIP_INSTALL: "1",
                ...opts.env,
            },
        },
    );
    return {
        code: result.status ?? -1,
        stdout: result.stdout?.toString() || "",
        stderr: result.stderr?.toString() || "",
    };
}

describe("cli-create dep normalization", () => {
    const cleanups: Array<() => Promise<void>> = [];

    afterAll(async () => {
        for (const c of cleanups) await c();
    });

    it("writes ^cliVersion and zero workspace: literal", async () => {
        const { cwd, cleanup } = await makeTmpCwd("npm");
        cleanups.push(cleanup);

        const r = runCreate({
            cwd,
            name: "demo-npm",
            template: "vue3-ts",
            bundler: "webpack",
        });
        if (r.code !== 0) {
            const pkgPath = path.join(cwd, "demo-npm/package.json");
            const exists = await fs.stat(pkgPath).catch(() => null);
            if (!exists) {
                throw new Error(
                    `cli-create failed (code=${r.code}):\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
                );
            }
        }

        const pkg = JSON.parse(await fs.readFile(path.join(cwd, "demo-npm/package.json"), "utf-8"));
        const text = JSON.stringify(pkg);

        expect(text).not.toContain("workspace:");
        expect(pkg.devDependencies["@bundlekit/service"]).toBe("*");
        expect(pkg.devDependencies["@bundlekit/plugin-vue"]).toBe("*");
        expect(pkg.devDependencies["@bundlekit/bundler-webpack"]).toMatch(/^\^/);
        // 防御：不含 ^1.0.0 死硬编码
        expect(text).not.toContain('"^1.0.0"');
    });
});

describe("cli-create generator prompt silenced", () => {
    const cleanups: Array<() => Promise<void>> = [];

    afterAll(async () => {
        for (const c of cleanups) await c();
    });

    async function createAndReadPkg(label: string, env: Record<string, string>) {
        const { cwd, cleanup } = await makeTmpCwd(label);
        cleanups.push(cleanup);
        const r = runCreate({
            cwd,
            name: "demo-prompt",
            template: "react-ts",
            bundler: "vite",
            env,
        });
        const pkgPath = path.join(cwd, "demo-prompt/package.json");
        const exists = await fs.stat(pkgPath).catch(() => null);
        if (!exists) {
            throw new Error(`cli-create failed:\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
        }
        return JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    }

    it("DEVKIT_NO_PROMPT=1 skips @bundlekit/request prompt, no ^1.0.0 literal", async () => {
        const pkg = await createAndReadPkg("no-prompt", {
            DEVKIT_NO_PROMPT: "1",
        });
        const text = JSON.stringify(pkg);
        // generator 跳过 → request 不会被写入
        expect(pkg.dependencies?.["@bundlekit/request"]).toBeUndefined();
        // 防御：无任何 ^1.0.0 死硬编码版本
        expect(text).not.toContain('"^1.0.0"');
        // 无 workspace:^ 残留
        expect(text).not.toContain("workspace:");
    });

    it("CI=true skips prompt, no hardcoded version literal", async () => {
        const pkg = await createAndReadPkg("ci-prompt", {
            CI: "true",
        });
        const text = JSON.stringify(pkg);
        expect(pkg.dependencies?.["@bundlekit/request"]).toBeUndefined();
        expect(text).not.toContain('"^1.0.0"');
        expect(text).not.toContain("workspace:");
    });
});

describe("cli-create SSR file filtering", () => {
    const cleanups: Array<() => Promise<void>> = [];

    afterAll(async () => {
        for (const c of cleanups) await c();
    });

    async function createAndCheckFiles(label: string, template: string, ssr: boolean) {
        const { cwd, cleanup } = await makeTmpCwd(label);
        cleanups.push(cleanup);

        const args = [CLI_BIN, "create", "demo-ssr", "-t", template, "-b", "vite", "-d", "test", "--pm", "pnpm"];
        if (ssr) args.push("--ssr");

        const result = spawnSync("node", args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
                ...process.env,
                DEVKIT_NO_INK: "1",
                DEVKIT_NO_PROMPT: "1",
                DEVKIT_SKIP_INSTALL: "1",
            },
        });

        const srcDir = path.join(cwd, "demo-ssr/src");
        const files = await fs.readdir(srcDir).catch(() => []);
        return { files, code: result.status ?? -1 };
    }

    it("generates entry-server.tsx and entry-client.tsx when --ssr is used", async () => {
        const { files, code } = await createAndCheckFiles("ssr-true", "react-ts", true);
        expect(code).toBe(0);
        expect(files).toContain("entry-server.tsx");
        expect(files).toContain("entry-client.tsx");
        expect(files).not.toContain("index.tsx");
    });

    it("skips entry-server.tsx and entry-client.tsx when --ssr is not used", async () => {
        const { files, code } = await createAndCheckFiles("ssr-false", "react-ts", false);
        expect(code).toBe(0);
        expect(files).not.toContain("entry-server.tsx");
        expect(files).not.toContain("entry-client.tsx");
        expect(files).toContain("index.tsx");
    });

    it("generates entry-server.ts and entry-client.ts for vue3 template with --ssr", async () => {
        const { files, code } = await createAndCheckFiles("ssr-vue", "vue3-ts", true);
        expect(code).toBe(0);
        expect(files).toContain("entry-server.ts");
        expect(files).toContain("entry-client.ts");
        expect(files).not.toContain("main.ts");
    });

    it("skips entry-server.ts and entry-client.ts for vue3 template without --ssr", async () => {
        const { files, code } = await createAndCheckFiles("ssr-vue-false", "vue3-ts", false);
        expect(code).toBe(0);
        expect(files).not.toContain("entry-server.ts");
        expect(files).not.toContain("entry-client.ts");
        expect(files).toContain("main.ts");
    });
});
