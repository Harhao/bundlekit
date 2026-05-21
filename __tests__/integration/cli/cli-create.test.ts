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
const CLI_BIN = path.resolve(REPO_ROOT, "packages/devkit-cli/dist/index.mjs");

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
        expect(pkg.devDependencies["@devkit/service"]).toMatch(/^\^/);
        expect(pkg.devDependencies["@devkit/plugin-vue"]).toMatch(/^\^/);
        expect(pkg.devDependencies["@devkit/bundler-webpack"]).toMatch(/^\^/);
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

    it("DEVKIT_NO_PROMPT=1 skips @devkit/request prompt, no ^1.0.0 literal", async () => {
        const pkg = await createAndReadPkg("no-prompt", {
            DEVKIT_NO_PROMPT: "1",
        });
        const text = JSON.stringify(pkg);
        // generator 跳过 → request 不会被写入
        expect(pkg.dependencies?.["@devkit/request"]).toBeUndefined();
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
        expect(pkg.dependencies?.["@devkit/request"]).toBeUndefined();
        expect(text).not.toContain('"^1.0.0"');
        expect(text).not.toContain("workspace:");
    });
});
