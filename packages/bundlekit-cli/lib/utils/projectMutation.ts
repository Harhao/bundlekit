import path from "path";
import { FileManager, BUNDLER_PACKAGE_MAP, resolveBundlerName } from "@bundlekit/shared-utils";
import type { IBundlerName } from "@bundlekit/shared-utils";
// 【低8】readCliVersion 已在 depMode.ts 实现，避免重复定义
import { readCliVersion } from "./depMode";

/**
 * 将选中的 bundler 写入 targetDir/package.json 的 devDependencies
 *
 * 版本范围使用 cli 自身版本（caret 前缀），假设 monorepo lockstep 发版。
 *
 * @param targetDir 项目根目录
 * @param bundlerInput bundler 短名 / "bundler-xxx" / "@bundlekit/bundler-xxx"
 * @returns 实际写入的 [pkgName, version] 或 null（输入非法时）
 */
export function addBundlerToDevDeps(
    targetDir: string,
    bundlerInput: string,
): [string, string] | null {

    const bundlerName = resolveBundlerName(bundlerInput);
    if (!bundlerName) return null;

    const pkgName = BUNDLER_PACKAGE_MAP[bundlerName as IBundlerName];
    const version = `^${readCliVersion()}`;

    const fm = new FileManager(targetDir);
    const pkgPath = "package.json";
    const pkg = fm.readJsonFile(pkgPath) as Record<string, any>;

    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies[pkgName] = version;

    // 字段排序：按字母序保持 devDependencies 整洁
    pkg.devDependencies = Object.fromEntries(
        Object.entries(pkg.devDependencies).sort(([a], [b]) => a.localeCompare(b)),
    );

    // 用 2-space 缩进写回，避免 fs-extra writeJsonSync 默认输出无格式
    fm.writeFileContent(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    return [pkgName, version];
}
