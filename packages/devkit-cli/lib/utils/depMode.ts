import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
    BUNDLER_PACKAGE_MAP,
    DEP_MODE_ENV_KEYS,
    type IBundlerName,
    type IDepMode,
} from "@devkit/shared-utils";

/**
 * 双重判定 monorepo 根：
 *   - 存在 pnpm-workspace.yaml
 *   - 存在 packages/devkit-service 子目录
 *
 * 双判避免误判其他 pnpm monorepo 含相同名字 packages 目录
 */
export function findMonorepoRoot(startDir: string): string | null {
    let dir = path.resolve(startDir);
    while (dir !== path.dirname(dir)) {
        const wsFile = path.join(dir, "pnpm-workspace.yaml");
        const sentinelDir = path.join(dir, "packages", "devkit-service");
        if (fs.existsSync(wsFile) && fs.existsSync(sentinelDir)) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return null;
}

/**
 * 读取 @devkit/cli 自身的版本号（用于 npm 模式的 ^${cliVersion}）
 *
 * 实现策略：
 *   1) require.resolve 解析（已发版 / monorepo 都适用）
 *   2) 相对 import.meta.url 向上查找
 *   3) "*" 兜底
 */
export function readCliVersion(): string {
    try {
        const req = createRequire(import.meta.url);
        const pkgJsonPath = req.resolve("@devkit/cli/package.json", {
            paths: [process.cwd()],
        });
        const pkg = req(pkgJsonPath) as { version?: string };
        if (pkg?.version) return pkg.version;
    } catch {}
    try {
        const dir = path.dirname(fileURLToPath(import.meta.url));
        const candidates = [
            path.resolve(dir, "../package.json"),
            path.resolve(dir, "../../package.json"),
        ];
        for (const candidate of candidates) {
            try {
                const req = createRequire(import.meta.url);
                const pkg = req(candidate) as { name?: string; version?: string };
                if (pkg?.name === "@devkit/cli" && pkg?.version) return pkg.version;
            } catch {}
        }
    } catch {}
    return "*";
}

/**
 * 决定依赖模式：env > monorepo 检测 > npm 兜底
 */
export function resolveDepMode(cwd: string, cliVersion?: string): IDepMode {
    const version = cliVersion ?? readCliVersion();

    // 1. 环境变量
    const envMode = process.env[DEP_MODE_ENV_KEYS.MODE];
    if (envMode === "link") {
        const explicitRoot = process.env[DEP_MODE_ENV_KEYS.MONOREPO_ROOT];
        if (explicitRoot && fs.existsSync(explicitRoot)) {
            return { kind: "link", monorepoRoot: path.resolve(explicitRoot), cliVersion: version };
        }
    }
    if (envMode === "npm") {
        return { kind: "npm", cliVersion: version };
    }

    // 2. 自动检测
    const detected = findMonorepoRoot(cwd);
    if (detected) {
        return { kind: "link", monorepoRoot: detected, cliVersion: version };
    }

    // 3. 默认
    return { kind: "npm", cliVersion: version };
}

/**
 * 给定 @devkit/* 短包名（如 "service" / "plugin-react" / "bundler-vite"），
 * 按 depMode 返回相应的依赖版本字符串：
 *   - link 模式 → "link:/abs/path/to/packages/devkit-{name}"
 *   - npm 模式  → "^{cliVersion}"
 */
export function resolveDevkitDepValue(shortPkg: string, mode: IDepMode): string {
    if (mode.kind === "link") {
        const target = path.join(mode.monorepoRoot!, "packages", `devkit-${shortPkg}`);
        return `link:${target}`;
    }
    return `^${mode.cliVersion}`;
}

/**
 * 给定 @devkit/<full> 完整包名，返回 short pkg 用于 link 路径拼接
 *   "@devkit/service"        → "service"
 *   "@devkit/plugin-react"   → "plugin-react"
 *   "@devkit/bundler-vite"   → "bundler-vite"
 */
export function shortNameFromFullPkg(fullPkg: string): string | null {
    const m = /^@devkit\/(.+)$/.exec(fullPkg.trim());
    return m ? m[1] : null;
}

/**
 * 把 targetDir/package.json 中所有 @devkit/* 依赖的 "workspace:^" 字面量
 * 替换为最终值（link 或 ^ver），并保证零残留。
 *
 * 写回时保持 2-space 缩进 + 末尾换行，避免 fs-extra 的默认压缩输出。
 */
export interface INormalizeDepsResult {
    /** 实际被替换的 entries：[fullPkg, oldValue, newValue] */
    replaced: Array<[string, string, string]>;
}

export function normalizeDeps(targetDir: string, mode: IDepMode): INormalizeDepsResult {
    const pkgPath = path.join(targetDir, "package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, any>;
    const replaced: Array<[string, string, string]> = [];

    const blocks = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    for (const block of blocks) {
        const deps = pkg[block];
        if (!deps || typeof deps !== "object") continue;
        for (const fullPkg of Object.keys(deps)) {
            const value = deps[fullPkg];
            if (typeof value !== "string") continue;
            if (!value.startsWith("workspace:")) continue;

            const short = shortNameFromFullPkg(fullPkg);
            if (!short) {
                // 非 @devkit/* 的 workspace:^（理论上不该出现），保守删除 workspace: 前缀
                deps[fullPkg] = value.replace(/^workspace:/, "");
                continue;
            }
            const next = resolveDevkitDepValue(short, mode);
            replaced.push([fullPkg, value, next]);
            deps[fullPkg] = next;
        }
    }

    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    return { replaced };
}

/**
 * 给定 bundler 短名（如 'vite'），按 depMode 写入 targetDir/package.json 的
 * devDependencies 中的 @devkit/bundler-{name} 字段。
 *
 * 此函数取代旧版 addBundlerToDevDeps 的硬编码版本号逻辑。
 */
export function writeBundlerDevDep(
    targetDir: string,
    bundlerName: IBundlerName,
    mode: IDepMode,
): [string, string] {
    const fullPkg = BUNDLER_PACKAGE_MAP[bundlerName];
    const value = resolveDevkitDepValue(`bundler-${bundlerName}`, mode);

    const pkgPath = path.join(targetDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, any>;
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies[fullPkg] = value;
    pkg.devDependencies = Object.fromEntries(
        Object.entries(pkg.devDependencies).sort(([a], [b]) => a.localeCompare(b)),
    );
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    return [fullPkg, value];
}
