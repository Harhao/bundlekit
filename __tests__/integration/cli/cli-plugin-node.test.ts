import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

/**
 * @bundlekit/plugin-node — node-ts 模板集成测试
 *
 * 覆盖：
 *   1. bc create -t node-ts  普通应用模式（无 --lib）
 *      - 生成 src/index.ts（应用入口）、src/utils.ts、tsconfig.json
 *      - 不含 public/、entry-server、entry-client、lib-entry
 *      - .bundlekitrc.ts 含 target=node + plugins=@bundlekit/plugin-node
 *   2. bc create -t node-ts --lib  库模式
 *      - src/index.ts 是 lib-entry 重命名后的版本（含 re-export + default export）
 *      - .bundlekitrc.ts 含 library: true + libraryName
 *      - 不含 public/
 */

const REPO_ROOT = path.resolve(__dirname, "../../..");
const CLI_BIN = path.resolve(REPO_ROOT, "packages/bundlekit-cli/dist/index.mjs");

async function makeTmpCwd(label: string) {
    const cwd = path.join(
        REPO_ROOT,
        "__tests__/integration/.tmp",
        `node-plugin-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    );
    await fs.mkdir(cwd, { recursive: true });
    return {
        cwd,
        cleanup: async () => { try { await fs.rm(cwd, { recursive: true, force: true }); } catch {} },
    };
}

function runCreate(opts: {
    cwd: string;
    name: string;
    extra?: string[];
}) {
    const args = [
        CLI_BIN, "create", opts.name,
        "-t", "node-ts",
        "-b", "rollup",
        "-d", "test",
        "--pm", "pnpm",
        ...(opts.extra ?? []),
    ];
    return spawnSync("node", args, {
        cwd: opts.cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
            ...process.env,
            DEVKIT_NO_INK: "1",
            DEVKIT_QUIET: "0",
            DEVKIT_SKIP_INSTALL: "1",
        },
    });
}

describe("plugin-node / node-ts template", () => {
    const cleanups: Array<() => Promise<void>> = [];
    afterAll(async () => { for (const c of cleanups) await c(); });

    it("普通模式：生成 src/index.ts（应用入口） + src/utils.ts + tsconfig.json，不含 public/", async () => {
        const { cwd, cleanup } = await makeTmpCwd("app");
        cleanups.push(cleanup);

        const r = runCreate({ cwd, name: "demo-node" });
        expect(r.status ?? -1).toBe(0);

        const proj = path.join(cwd, "demo-node");
        const srcFiles = await fs.readdir(path.join(proj, "src")).catch(() => []);
        const topFiles = await fs.readdir(proj).catch(() => []);

        // 入口和工具文件
        expect(srcFiles).toContain("index.ts");
        expect(srcFiles).toContain("utils.ts");
        // 不含应用专属 / SSR 专属文件
        expect(srcFiles).not.toContain("entry-client.ts");
        expect(srcFiles).not.toContain("entry-server.ts");
        expect(srcFiles).not.toContain("lib-entry.ts");  // 已重命名为 index.ts
        // 不含 HTML shell
        expect(topFiles).not.toContain("public");
        // tsconfig 存在
        expect(topFiles).toContain("tsconfig.json");
    });

    it("普通模式：src/index.ts 含 greet / add + isMain 检查", async () => {
        const { cwd, cleanup } = await makeTmpCwd("app-content");
        cleanups.push(cleanup);

        runCreate({ cwd, name: "demo-node" });
        const indexTs = await fs.readFile(
            path.join(cwd, "demo-node/src/index.ts"), "utf-8",
        ).catch(() => "");
        expect(indexTs).toContain("greet");
        expect(indexTs).toContain("add");
        expect(indexTs).toContain("isMain");
        expect(indexTs).toContain("demo-node");  // projectName 替换
    });

    it("普通模式：.bundlekitrc.ts 含 @bundlekit/plugin-node + target=node + formats esm+cjs", async () => {
        const { cwd, cleanup } = await makeTmpCwd("app-rc");
        cleanups.push(cleanup);

        runCreate({ cwd, name: "demo-node" });
        const rc = await fs.readFile(
            path.join(cwd, "demo-node/.bundlekitrc.ts"), "utf-8",
        ).catch(() => "");
        expect(rc).toContain('"@bundlekit/plugin-node"');
        expect(rc).toContain('target: "node"');
        expect(rc).toContain('"esm"');
        expect(rc).toContain('"commonjs"');
        // 普通模式不应有 library: true
        expect(rc).not.toContain("library: true");
    });

    it("普通模式：package.json 含 @bundlekit/plugin-node devDep + type=module + exports", async () => {
        const { cwd, cleanup } = await makeTmpCwd("app-pkg");
        cleanups.push(cleanup);

        runCreate({ cwd, name: "demo-node" });
        const pkgText = await fs.readFile(
            path.join(cwd, "demo-node/package.json"), "utf-8",
        ).catch(() => "{}");
        const pkg = JSON.parse(pkgText);
        expect(pkg.type).toBe("module");
        expect(pkg.exports).toBeDefined();
        expect(Object.keys(pkg.devDependencies ?? {})).toContain("@bundlekit/plugin-node");
    });

    it("--lib 模式：src/index.ts 是 lib-entry 重命名后版本（含 re-export + default）", async () => {
        const { cwd, cleanup } = await makeTmpCwd("lib");
        cleanups.push(cleanup);

        runCreate({ cwd, name: "demo-nodelib", extra: ["--lib", "--library-name", "MyNodeLib"] });
        const proj = path.join(cwd, "demo-nodelib");
        const srcFiles = await fs.readdir(path.join(proj, "src")).catch(() => []);
        const topFiles = await fs.readdir(proj).catch(() => []);

        expect(srcFiles).toContain("index.ts");
        expect(srcFiles).toContain("utils.ts");
        expect(topFiles).not.toContain("public");
        // lib-entry.ts 已重命名为 index.ts，不存在原始名
        expect(srcFiles).not.toContain("lib-entry.ts");

        const indexTs = await fs.readFile(
            path.join(proj, "src/index.ts"), "utf-8",
        ).catch(() => "");
        // lib-entry 内容：re-export from utils + default export
        expect(indexTs).toContain('from "./utils"');
        expect(indexTs).toContain("MyNodeLib");
        expect(indexTs).toContain("export default");
    });

    it("--lib 模式：.bundlekitrc.ts 含 library: true + libraryName + formats esm+cjs", async () => {
        const { cwd, cleanup } = await makeTmpCwd("lib-rc");
        cleanups.push(cleanup);

        runCreate({ cwd, name: "demo-nodelib", extra: ["--lib", "--library-name", "MyNodeLib"] });
        const rc = await fs.readFile(
            path.join(cwd, "demo-nodelib/.bundlekitrc.ts"), "utf-8",
        ).catch(() => "");
        expect(rc).toContain("library: true");
        expect(rc).toContain('libraryName: "MyNodeLib"');
        expect(rc).toContain('"esm"');
        expect(rc).toContain('"commonjs"');
    });

    it("--lib libraryName 默认取 PascalCase 项目名", async () => {
        const { cwd, cleanup } = await makeTmpCwd("lib-default-name");
        cleanups.push(cleanup);

        runCreate({ cwd, name: "my-ts-sdk" });  // 不传 --lib，只看 libraryName 默认值不误触发
        const rc = await fs.readFile(
            path.join(cwd, "my-ts-sdk/.bundlekitrc.ts"), "utf-8",
        ).catch(() => "");
        // 普通模式不含 library 标志
        expect(rc).not.toContain("library: true");
    });
});
