import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { spawnSync } from "node:child_process";
import { createCliFixture } from "./cliFixture";

export interface IBuildSmokeOptions {
    bundler: "webpack" | "vite" | "rspack" | "rollup" | "rolldown" | "parcel" | "esbuild";
    /** 项目名（默认 demo-build） */
    projectName?: string;
}

/**
 * 端到端 build 烟雾测试（仅 node-ts 模板）：
 *   1. cli create node-ts × bundler
 *   2. install + 跑 build（pnpm exec bundlekit-service build --mode production）
 *   3. 校验 dist/ 输出文件存在
 *   4. require/import 该文件，验证它能被 Node 正常加载
 *   5. node-ts 模板入口为空，仅校验 module 导出对象（典型 cli 模板会 export {} 或具名）
 *
 * 这一套断言能拦下你之前 Issue 2「node-ts 模板输出文件名与 main 字段错位」：
 *   - 模板 main: ./dist/index.js 但实际产物 ./dist/app.js → require 会 404
 *   - 我们已经在 deriveChunkName 修复 chunk 名 = entry basename
 */
export async function assertNodeBuild(opts: IBuildSmokeOptions): Promise<void> {
    const projectName = opts.projectName || "demo-build";
    const fixture = await createCliFixture({
        template: "node-ts",
        bundler: opts.bundler,
        ssr: false,
        projectName,
    });

    try {
        // 1. 跑 build
        const result = spawnSync(
            "pnpm",
            ["exec", "bundlekit-service", "build", "--mode", "production"],
            {
                cwd: fixture.dir,
                stdio: ["ignore", "pipe", "pipe"],
                env: { ...process.env, CI: "1" },
                timeout: 120_000,
            },
        );
        if (result.status !== 0) {
            throw new Error(
                `[node-ts/${opts.bundler}] build failed (code=${result.status}):\n` +
                `STDOUT: ${result.stdout?.toString() || ""}\n` +
                `STDERR: ${result.stderr?.toString() || ""}`,
            );
        }

        // 2. 读 package.json 的 main 字段
        const pkg = JSON.parse(
            fsSync.readFileSync(path.join(fixture.dir, "package.json"), "utf-8"),
        ) as { main?: string };
        const main = pkg.main;
        if (!main) {
            throw new Error(`[node-ts/${opts.bundler}] package.json 缺少 main 字段`);
        }

        // 3. main 字段指向的文件必须存在
        const mainPath = path.resolve(fixture.dir, main);
        if (!fsSync.existsSync(mainPath)) {
            const distFiles = await fs.readdir(path.join(fixture.dir, "dist")).catch(() => []);
            throw new Error(
                `[node-ts/${opts.bundler}] package.json main "${main}" 指向的文件不存在\n` +
                `dist/ 实际文件: ${distFiles.join(", ")}`,
            );
        }

        // 4. 文件能被 Node 加载（捕获语法错误等编译期问题）
        // 用子进程隔离，避免 cache / 全局污染
        const sniff = spawnSync(
            "node",
            ["-e", `(async () => { const m = await import(${JSON.stringify(mainPath)}); console.log(typeof m); })();`],
            { stdio: "pipe", timeout: 15_000 },
        );
        if (sniff.status !== 0) {
            throw new Error(
                `[node-ts/${opts.bundler}] 无法 import 构建产物 ${main}:\n` +
                `STDOUT: ${sniff.stdout?.toString() || ""}\n` +
                `STDERR: ${sniff.stderr?.toString() || ""}`,
            );
        }
    } finally {
        await fixture.cleanup();
    }
}
