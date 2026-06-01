import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { Creator } from "../../../packages/bundlekit-cli/lib/commands/create/creator";

export interface ICliFixtureOptions {
    /** cli create -t 参数 */
    template: "react-ts" | "react-js" | "vue3-ts" | "vue3-js" | "svelte-ts" | "svelte-js" | "angular-ts" | "angular-js" | "node-ts";
    /** cli create -b 参数 */
    bundler: "webpack" | "vite" | "rspack" | "rollup" | "rolldown" | "parcel" | "esbuild";
    /** cli create --ssr 参数（不传等同 false） */
    ssr?: boolean;
    /** 项目名（默认 `demo-smoke`） */
    projectName?: string;
}

export interface ICliFixtureHandle {
    /** 项目根目录（已 install） */
    dir: string;
    /** 项目名 */
    projectName: string;
    /** 清理 */
    cleanup: () => Promise<void>;
}

const REPO_ROOT = path.resolve(__dirname, "../../..");
const TMP_ROOT = path.resolve(REPO_ROOT, "__tests__/integration/.tmp");

/**
 * 把 cli create 生成的项目里所有 @bundlekit/* 依赖改写为 link: 协议，指向
 * monorepo 内对应包目录。
 *
 * 这一步是让 cli create 的产物 install 速度从「秒到分钟」回到「秒级」的关键：
 *   - 默认 cli 写的是 ^X.Y.Z（registry 版本），install 时 pnpm 会去 npm
 *     下载 monorepo 还没发布的版本 → 失败
 *   - 用 link: 协议指向 monorepo packages/，pnpm 直接 symlink，秒级完成
 */
function rewriteBundlekitDepsToLink(projectDir: string): void {
    const pkgPath = path.join(projectDir, "package.json");
    const pkg = JSON.parse(fsSync.readFileSync(pkgPath, "utf-8")) as Record<string, any>;

    const linkRoot = path.relative(projectDir, REPO_ROOT);

    const rewriteMap = (deps?: Record<string, string>) => {
        if (!deps) return;
        for (const name of Object.keys(deps)) {
            if (name.startsWith("@bundlekit/")) {
                const shortName = name.replace("@bundlekit/", "bundlekit-");
                const linkPath = path.join(linkRoot, "packages", shortName);
                deps[name] = `link:${linkPath}`;
            }
        }
    };

    rewriteMap(pkg.dependencies);
    rewriteMap(pkg.devDependencies);

    fsSync.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

/**
 * 写入 pnpm-workspace.yaml，防止 pnpm install 向上穿透到 monorepo 根的 workspace 配置。
 */
function writeIsolatedWorkspace(projectDir: string): void {
    fsSync.writeFileSync(
        path.join(projectDir, "pnpm-workspace.yaml"),
        "packages:\n  - '.'\n",
    );
}

/**
 * 在项目目录跑 pnpm install。link: 协议下应在 1-3s 完成。
 */
function installInProject(projectDir: string): void {
    const result = spawnSync("pnpm", ["install", "--prefer-offline", "--no-frozen-lockfile"], {
        cwd: projectDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CI: "1" },
    });
    if (result.status !== 0) {
        throw new Error(
            `pnpm install in ${projectDir} failed (status=${result.status}):\n` +
            `STDOUT: ${result.stdout?.toString() || ""}\n` +
            `STDERR: ${result.stderr?.toString() || ""}`,
        );
    }
}

/**
 * 用 cli create 生成一个真实模板项目，并完成 link: 重写 + install。
 *
 * 与 fixtures/ 下手工 fixture 的区别：
 *   - 用真实模板 → 能拦下「模板生成对，但 bundler 跑不起来」的回归
 *   - 也能拦下「模板 package.json 字段错位」的问题（如 node-ts main）
 */
export async function createCliFixture(opts: ICliFixtureOptions): Promise<ICliFixtureHandle> {
    const projectName = opts.projectName || "demo-smoke";

    await fs.mkdir(TMP_ROOT, { recursive: true });
    const cwd = await fs.mkdtemp(
        path.join(TMP_ROOT, `cli-${opts.template}-${opts.bundler}-${opts.ssr ? "ssr-" : ""}`),
    );

    // 1. 静默 cli + 跳过 cli 自身的 install（我们要自己改 link: 后再 install）
    const prevEnv = {
        DEVKIT_QUIET: process.env.DEVKIT_QUIET,
        DEVKIT_NO_PROMPT: process.env.DEVKIT_NO_PROMPT,
        DEVKIT_SKIP_INSTALL: process.env.DEVKIT_SKIP_INSTALL,
        CI: process.env.CI,
    };
    process.env.DEVKIT_QUIET = "1";
    process.env.DEVKIT_NO_PROMPT = "1";
    process.env.DEVKIT_SKIP_INSTALL = "1";
    process.env.CI = "true";

    try {
        const creator = new Creator();
        await creator.create(projectName, {
            cwd,
            template: opts.template,
            bundler: opts.bundler,
            pm: "pnpm",
            description: "cli smoke test",
            ssr: !!opts.ssr,
        });
    } finally {
        // 还原 env
        for (const [k, v] of Object.entries(prevEnv)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }

    const projectDir = path.join(cwd, projectName);

    // 2. 把 @bundlekit/* 依赖改成 link:，避免 install 走 npm registry
    rewriteBundlekitDepsToLink(projectDir);

    // 3. 写 pnpm-workspace.yaml 防止穿透
    writeIsolatedWorkspace(projectDir);

    // 4. install（link: 协议下秒级）
    installInProject(projectDir);

    return {
        dir: projectDir,
        projectName,
        cleanup: async () => {
            try {
                await fs.rm(cwd, { recursive: true, force: true });
            } catch {}
        },
    };
}
