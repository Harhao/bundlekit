import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { FileManager, Logger, PackageManager, EPackageMangerTool } from "@bundlekit/shared-utils";
import type { IDepMode } from "@bundlekit/shared-utils";
import Generator from "../../generator";
import { buildGeneratorAPI, invokeGenerator } from "../../utils/generatorRunner";
import { normalizeDeps, writeBundlerDevDep, resolveDepMode } from "../../utils/depMode";
import { resolveBundlerName } from "@bundlekit/shared-utils";

export type PMName = "pnpm" | "yarn" | "npm";

export { resolveDepMode } from "../../utils/depMode";

export interface ICreateOptions {
    name: string;
    template: string;
    bundler: string;
    description?: string;
    cwd?: string;
    pm?: PMName;
    ssr?: boolean;
    /** 类库 / SDK 模式：跳过 HTML 入口，输出 esm/cjs/umd 多格式 */
    library?: boolean;
    /** UMD/IIFE 全局变量名（仅 library 模式有效） */
    libraryName?: string;
}

/** 项目名 + 路径校验，失败时抛错 */
export function validateProject(name: string, cwd: string): { targetDir: string } {
    if (!/^[a-z0-9@.\-_]+$/.test(name)) {
        throw new Error(`项目名称 "${name}" 不合法，只能包含小写字母、数字、@、.、-、_`);
    }
    const targetDir = path.resolve(cwd, name);
    const fm = new FileManager(cwd);
    if (fm.isFilePathExist(targetDir)) {
        throw new Error(`目录 ${targetDir} 已存在，请选择其他项目名称`);
    }
    return { targetDir };
}

/** 推断模板对应的框架插件包名 */
export function resolvePluginPkgName(template: string): string {
    const normalized = normalizeTemplate(template);
    return normalized.startsWith("vue") ? "@bundlekit/plugin-vue" : "@bundlekit/plugin-react";
}

export function normalizeTemplate(template: string): string {
    const aliases: Record<string, string> = {
        react:      "react-ts",
        vue:        "vue3-ts",
        vue3:       "vue3-ts",
        "react-ts": "react-ts",
        "react-js": "react-js",
        "vue3-ts":  "vue3-ts",
        "vue3-js":  "vue3-js",
    };
    return aliases[template] ?? template;
}

/** 解析模板目录路径（require.resolve 优先 / 相对路径兜底） */
export function resolveTemplateDir(template: string): string {
    const normalized = normalizeTemplate(template);
    const pluginPkgName = resolvePluginPkgName(template);

    try {
        const require = createRequire(import.meta.url);
        const pkgJsonPath = require.resolve(`${pluginPkgName}/package.json`);
        const templateDir = path.join(path.dirname(pkgJsonPath), "templates", `template-${normalized}`);
        if (fs.existsSync(templateDir)) return templateDir;
    } catch {}

    const __dir = path.dirname(fileURLToPath(import.meta.url));
    const pluginDirName = pluginPkgName.replace("@bundlekit/", "bundlekit-");
    const monorepoDir = path.resolve(__dir, "../..", pluginDirName, "templates", `template-${normalized}`);
    if (fs.existsSync(monorepoDir)) return monorepoDir;

    throw new Error(`模板 "${template}" 未找到，可用模板：react-ts / react-js / vue3-ts / vue3-js`);
}

/** 渲染模板到 targetDir */
export async function renderTemplates(opts: {
    targetDir: string;
    templateDir: string;
    projectName: string;
    description?: string;
    bundler: string;
    ssr?: boolean;
    library?: boolean;
    libraryName?: string;
}): Promise<void> {
    const generator = new Generator({
        templateDir: opts.templateDir,
        targetDir: opts.targetDir,
        context: {
            projectName: opts.projectName,
            description: opts.description || "",
            bundler: opts.bundler,
            ssr: !!opts.ssr,
            library: !!opts.library,
            // libraryName fallback 到项目名转 PascalCase（兼容 UMD/IIFE 全局变量名规则）
            libraryName: opts.libraryName || toPascalCase(opts.projectName),
        },
    });
    await generator.generate();
}

/**
 * project name → PascalCase（用作 UMD libraryName 默认值）。
 *   "my-lib" → "MyLib"，"@scope/foo-bar" → "FooBar"
 */
function toPascalCase(name: string): string {
    return name
        .replace(/^@[^/]+\//, "")
        .split(/[-_/.]/)
        .filter(Boolean)
        .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
        .join("");
}

/** 把所选 bundler 写入 targetDir/package.json 的 devDependencies（按 depMode） */
export function injectBundlerToDeps(
    targetDir: string,
    bundler: string,
    depMode: IDepMode,
): [string, string] | null {
    const bundlerName = resolveBundlerName(bundler);
    if (!bundlerName) return null;
    return writeBundlerDevDep(targetDir, bundlerName, depMode);
}

/** 规范化生成项目 package.json 中的 @bundlekit/* 依赖（替换 workspace:^） */
export function normalizeProjectDeps(targetDir: string, depMode: IDepMode): void {
    normalizeDeps(targetDir, depMode);
}

/**
 * pnpm@10+ 将 pnpm.cjs 改为 `import('./pnpm.mjs')` shim，
 * 在 corepack v0.32 + Node.js 20 的内部模块加载器中触发
 * ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING。
 *
 * 修复策略：从父目录向上查找兼容的 packageManager（pnpm@8/9），
 * 注入到新项目的 package.json，让 corepack 加载已知可用版本。
 * 若找不到，删除 auto-pin 写入的 11.x 字段。
 */
function fixPnpmCompatibility(targetDir: string): void {
    const pkgPath = path.join(targetDir, "package.json");
    if (!fs.existsSync(pkgPath)) return;

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, any>;
    const currentPm: string | undefined = pkg.packageManager;

    // pnpm@10+ 与 corepack v0.32 + Node.js 20 不兼容
    const isIncompatible = currentPm && /^pnpm@(1\d|\d{2,})\./.test(currentPm);
    const needsLookup = !currentPm || isIncompatible;
    if (!needsLookup) return;

    // 向上查找第一个带 pnpm@8.x 或 pnpm@9.x 的父级 package.json
    let found: string | null = null;
    let current = path.dirname(targetDir);
    while (true) {
        const pp = path.join(current, "package.json");
        if (fs.existsSync(pp)) {
            try {
                const parentPkg = JSON.parse(fs.readFileSync(pp, "utf-8")) as Record<string, any>;
                const ppm: string | undefined = parentPkg.packageManager;
                if (ppm && /^pnpm@[89]\./.test(ppm)) {
                    found = ppm;
                    break;
                }
            } catch {}
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }

    if (found) {
        pkg.packageManager = found;
    } else if (currentPm) {
        // 无法找到兼容版本：删除 auto-pin 字段，避免 corepack 反复尝试 11.x
        delete pkg.packageManager;
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

/** 安装 targetDir 下的所有 deps */
export async function installDeps(
    targetDir: string,
    opts?: { pm?: PMName },
): Promise<void> {
    const forced = opts?.pm
        ? (opts.pm as unknown as EPackageMangerTool)
        : undefined;

    // pnpm@10+ 与 corepack v0.32 + Node.js 20 存在 dynamic import 兼容性问题
    // 安装前注入兼容版本（pnpm@8/9），或删除 corepack auto-pin 的 11.x 字段
    if (!forced || forced === EPackageMangerTool.PNPM) {
        fixPnpmCompatibility(targetDir);
    }

    const pm = new PackageManager({
        context: targetDir,
        forcePackageManager: forced,
    });
    try {
        const success = await pm.install();
        if (!success) {
            // 防御性分支：executeCommand 正常情况已改为 throw，此处兜底
            throw new Error("包管理器返回失败状态");
        }
    } catch (err) {
        const raw = (err as Error).message || String(err);

        // pnpm corepack 兼容性问题：自动 fallback 到 npm
        if (
            (!forced || forced === EPackageMangerTool.PNPM) &&
            raw.includes("ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING")
        ) {
            try {
                const npmPm = new PackageManager({
                    context: targetDir,
                    forcePackageManager: EPackageMangerTool.NPM,
                });
                const ok = await npmPm.install();
                if (ok) {
                    // fallback 成功：在 package.json 写回正确的 packageManager
                    // (删除 corepack auto-pin 的 pnpm@11.x 字段)
                    fixPnpmCompatibility(targetDir);
                    return;
                }
            } catch {}
            // fallback 也失败，抛出友好提示
            throw new Error(
                "依赖安装失败：检测到 pnpm（corepack 管理）与当前 Node.js 版本存在兼容性问题。\n" +
                "建议：\n" +
                "  1. 手动进入项目目录后运行 `npm install`\n" +
                "  2. 或升级 Node.js 到 v22+\n" +
                "  3. 或在系统中安装独立版 pnpm（不通过 corepack）",
            );
        }

        // 截取 stderr 精华（最多 800 字符），去掉 "Command failed with exit code N: ..." 首行前缀
        const detail = raw
            .replace(/^Command failed with exit code \d+:[^\n]*\n?/, "")
            .trim()
            .slice(0, 800);
        const hint = detail
            ? `依赖安装失败，请检查网络连接或包管理器配置\n\n${detail}`
            : "依赖安装失败，请检查网络连接或包管理器配置";
        throw new Error(hint);
    }
}

/** 同步检测系统 PATH 上可用的包管理器 */
export function detectAvailablePMs(): Record<PMName, boolean> {
    const check = (bin: string): boolean => {
        try {
            const result = spawnSync(bin, ["--version"], {
                stdio: "ignore",
                shell: process.platform === "win32",
                // 禁用 corepack strict 模式：避免当项目 package.json 指定了特定
                // packageManager 版本但全局安装版本不同时，corepack 拦截并返回非零退出码
                env: { ...process.env, COREPACK_ENABLE_STRICT: "0" },
            });
            return result.status === 0 && !result.error;
        } catch {
            return false;
        }
    };
    return {
        pnpm: check("pnpm"),
        yarn: check("yarn"),
        npm: check("npm"),
    };
}

/**
 * 调用框架插件 generator
 * @returns 是否有新依赖追加（用于决定是否再次 install）
 */
export async function runGenerator(
    pluginPkgName: string,
    targetDir: string,
    logger: Logger,
): Promise<boolean> {
    const api = buildGeneratorAPI(targetDir, logger);
    return invokeGenerator(pluginPkgName, targetDir, api, logger);
}
