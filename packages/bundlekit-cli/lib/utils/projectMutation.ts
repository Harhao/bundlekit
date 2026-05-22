import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { FileManager, BUNDLER_PACKAGE_MAP, resolveBundlerName } from "@bundlekit/shared-utils";
import type { IBundlerName } from "@bundlekit/shared-utils";

/**
 * 读取 @bundlekit/cli 自身的版本号
 *
 * 实现策略：
 * 1) 优先用 require.resolve 解析 cli 包的 package.json（已发版 / monorepo 都适用）
 * 2) 兜底：相对 import.meta.url 向上查找
 * 3) 最终兜底：返回 "*"
 */
export function readCliVersion(): string {
    try {
        const require = createRequire(import.meta.url);
        const pkgJsonPath = require.resolve("@bundlekit/cli/package.json", {
            paths: [process.cwd()],
        });
        const pkg = require(pkgJsonPath) as { version?: string };
        if (pkg?.version) return pkg.version;
    } catch {}

    try {
        const dir = path.dirname(fileURLToPath(import.meta.url));
        const candidatePaths = [
            path.resolve(dir, "../package.json"),
            path.resolve(dir, "../../package.json"),
        ];
        for (const candidate of candidatePaths) {
            try {
                const require = createRequire(import.meta.url);
                const pkg = require(candidate) as { name?: string; version?: string };
                if (pkg?.name === "@bundlekit/cli" && pkg?.version) return pkg.version;
            } catch {}
        }
    } catch {}

    return "*";
}

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
