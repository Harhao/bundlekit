import type { IBuildTools } from "../cli-service/adapter";

export interface init {}

/**
 * 5 个内置 bundler 的短名 → npm 包名映射
 * 供 cli (create / add) 与 service (运行时缺失提示) 共享
 */
export const BUNDLER_PACKAGE_MAP: Record<IBuildTools, string> = {
    webpack:  "@devkit/bundler-webpack",
    vite:     "@devkit/bundler-vite",
    rspack:   "@devkit/bundler-rspack",
    rollup:   "@devkit/bundler-rollup",
    rolldown: "@devkit/bundler-rolldown",
};

/** bundler 短名（同 IBuildTools） */
export type IBundlerName = IBuildTools;
/** bundler 完整 npm 包名 */
export type IBundlerPackage = (typeof BUNDLER_PACKAGE_MAP)[IBundlerName];

const BUNDLER_NAMES = Object.keys(BUNDLER_PACKAGE_MAP) as IBundlerName[];

/**
 * 由任意输入解析为 bundler 短名
 * 接受：
 * - 短名 "vite"
 * - "bundler-vite"
 * - "@devkit/bundler-vite"
 */
export function resolveBundlerName(input: string): IBundlerName | null {
    const trimmed = input.trim();
    if (BUNDLER_NAMES.includes(trimmed as IBundlerName)) {
        return trimmed as IBundlerName;
    }
    if (trimmed.startsWith("bundler-")) {
        const short = trimmed.slice("bundler-".length);
        if (BUNDLER_NAMES.includes(short as IBundlerName)) {
            return short as IBundlerName;
        }
    }
    if (trimmed.startsWith("@devkit/bundler-")) {
        const short = trimmed.slice("@devkit/bundler-".length);
        if (BUNDLER_NAMES.includes(short as IBundlerName)) {
            return short as IBundlerName;
        }
    }
    return null;
}

/**
 * 由任意输入解析为 bundler npm 包名（不在映射中返回 null）
 */
export function resolveBundlerPackage(input: string): string | null {
    const name = resolveBundlerName(input);
    return name ? BUNDLER_PACKAGE_MAP[name] : null;
}
