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

/**
 * cli 创建项目时的依赖处理模式
 *
 * - link：在 monorepo 内开发，写绝对路径 link: 协议
 * - npm：默认模式，写 ^cliVersion，假设 monorepo lockstep 发版
 *
 * 旁路：
 *   - DEVKIT_DEP_MODE=link|npm
 *   - DEVKIT_MONOREPO_ROOT=/path（link 模式必填，npm 模式忽略）
 */
export type IDepModeKind = "link" | "npm";

export interface IDepMode {
    kind: IDepModeKind;
    /** kind === 'link' 时是 monorepo 根目录绝对路径 */
    monorepoRoot?: string;
    /** cli 自身版本号，npm 模式下用作 ^${cliVersion} */
    cliVersion: string;
}

export const DEP_MODE_ENV_KEYS = {
    MODE: "DEVKIT_DEP_MODE",
    MONOREPO_ROOT: "DEVKIT_MONOREPO_ROOT",
} as const;
