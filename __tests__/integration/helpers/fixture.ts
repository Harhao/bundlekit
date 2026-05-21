import path from "node:path";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

/**
 * Fixture 隔离：把 fixtures/<bundler>/ 复制到 __tests__/integration/.tmp/<rand>/，
 * 在临时目录里跑 install + build，避免污染源 fixture。
 *
 * 临时目录放在 monorepo 内（不放 /tmp）的原因：
 *   - fixture 的 package.json 用 `link:../../packages/devkit-service` 等相对路径
 *     引用 monorepo 包，让 pnpm install 在 fixture 内秒级完成（无需 publish）
 *   - 必须在 monorepo 文件树内才能保证相对路径解析正确
 *
 * mode 参数控制使用哪份 .devkitrc：
 *   - 'spa' → .devkitrc.spa.ts → 复制为 .devkitrc.ts
 *   - 'lib' → .devkitrc.lib.ts → 复制为 .devkitrc.ts
 *   - 'ssr' → .devkitrc.ssr.ts → 复制为 .devkitrc.ts
 */
export type FixtureMode = "spa" | "lib" | "ssr";

export interface IFixtureHandle {
    /** 临时项目根目录 */
    dir: string;
    /** 清理钩子 */
    cleanup: () => Promise<void>;
}

const FIXTURES_ROOT = path.resolve(__dirname, "../fixtures");
const TMP_ROOT = path.resolve(__dirname, "../.tmp");
const ROOT = path.resolve(__dirname, "../../..");

export async function copyFixture(bundler: string, mode: FixtureMode): Promise<IFixtureHandle> {
    const src = path.join(FIXTURES_ROOT, bundler);
    const stat = await fs.stat(src).catch(() => null);
    if (!stat || !stat.isDirectory()) {
        throw new Error(`fixture not found: ${src}`);
    }
    await fs.mkdir(TMP_ROOT, { recursive: true });
    const tmpRoot = path.join(TMP_ROOT, `${bundler}-${mode}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    await fs.mkdir(tmpRoot, { recursive: true });

    // 1) 拷 bundler-specific files（含 3 份 .devkitrc.<mode>.ts + package.json）
    await copyDir(src, tmpRoot);

    // 2) 拷 shared/ 进去
    await copyDir(
        path.join(FIXTURES_ROOT, "shared"),
        path.join(tmpRoot, "shared"),
    );

    // 3) 把 .devkitrc.<mode>.ts 选定为 .devkitrc.ts
    const modeConfig = path.join(tmpRoot, `.devkitrc.${mode}.ts`);
    const finalConfig = path.join(tmpRoot, ".devkitrc.ts");
    const exists = await fs.stat(modeConfig).catch(() => null);
    if (!exists) {
        throw new Error(`fixture ${bundler} 缺少 .devkitrc.${mode}.ts`);
    }
    await fs.copyFile(modeConfig, finalConfig);

    return {
        dir: tmpRoot,
        cleanup: async () => {
            try {
                await fs.rm(tmpRoot, { recursive: true, force: true });
            } catch {}
        },
    };
}

async function copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const e of entries) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        const s = path.join(src, e.name);
        const d = path.join(dest, e.name);
        if (e.isDirectory()) {
            await copyDir(s, d);
        } else {
            await fs.copyFile(s, d);
        }
    }
}

/**
 * 在 fixture dir 跑 pnpm install
 *
 * fixture 的 package.json 用 link: 协议引 monorepo 包，pnpm install 秒级完成
 * （仅 react/react-dom 等真实 npm 包需下载，已有 monorepo store 缓存）。
 */
export function installInFixture(dir: string): void {
    const result = spawnSync("pnpm", ["install", "--prefer-offline", "--no-frozen-lockfile"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, CI: "1" },
    });
    if (result.status !== 0) {
        throw new Error(
            `pnpm install in ${dir} failed (status=${result.status}):\n` +
            `STDOUT: ${result.stdout?.toString() || ""}\n` +
            `STDERR: ${result.stderr?.toString() || ""}`,
        );
    }
}

/** monorepo 仓库根 */
export function repoRoot(): string {
    return ROOT;
}
