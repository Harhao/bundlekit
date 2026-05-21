import path from "node:path";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { copyFixture, installInFixture, FixtureMode } from "./fixture";

export interface IBuildResult {
    /** 退出码 */
    code: number;
    /** stdout 内容 */
    stdout: string;
    /** stderr 内容 */
    stderr: string;
    /** fixture 临时目录 */
    dir: string;
    /** 清理 */
    cleanup: () => Promise<void>;
}

/**
 * 在 fixture 中运行 `pnpm exec devkit-service build` 并返回结果。
 *
 * 调用方负责 cleanup（即使 code !== 0）。
 */
export async function runBuild(
    bundler: string,
    mode: FixtureMode,
    options: { skipInstall?: boolean } = {},
): Promise<IBuildResult> {
    const handle = await copyFixture(bundler, mode);
    try {
        if (!options.skipInstall) {
            installInFixture(handle.dir);
        }

        const result = spawnSync(
            "pnpm",
            ["exec", "devkit-service", "build", "--mode", "production"],
            {
                cwd: handle.dir,
                stdio: ["ignore", "pipe", "pipe"],
                env: {
                    ...process.env,
                    DEVKIT_QUIET: "1",
                    CI: "1",
                },
            },
        );

        return {
            code: result.status ?? -1,
            stdout: result.stdout?.toString() || "",
            stderr: result.stderr?.toString() || "",
            dir: handle.dir,
            cleanup: handle.cleanup,
        };
    } catch (e) {
        await handle.cleanup();
        throw e;
    }
}

/**
 * 断言 fixture dir 内某文件存在，返回绝对路径
 */
export async function expectFileExists(dir: string, relativePath: string): Promise<string> {
    const abs = path.resolve(dir, relativePath);
    const stat = await fs.stat(abs).catch(() => null);
    if (!stat) {
        throw new Error(`expected file not found: ${abs}`);
    }
    return abs;
}

/**
 * 读 fixture 内某文件文本
 */
export async function readBuiltFile(dir: string, relativePath: string): Promise<string> {
    const abs = await expectFileExists(dir, relativePath);
    return fs.readFile(abs, "utf-8");
}
