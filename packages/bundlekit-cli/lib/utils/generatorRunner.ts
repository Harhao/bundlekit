import path from "path";
import fs from "fs";
import Enquirer from "enquirer";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";
import { Logger } from "@bundlekit/shared-utils";
import type { IGeneratorAPI } from "@bundlekit/shared-utils";

interface PendingDep {
    pkgName: string;
    version: string;
    dev: boolean;
}

/**
 * 构建 IGeneratorAPI 实现。
 * - prompt：Enquirer 驱动
 * - addDependency：写入 package.json，由调用方在 generator 完成后统一 install
 */
export function buildGeneratorAPI(context: string, logger: Logger): IGeneratorAPI {
    const enquirer = new Enquirer();
    const pendingDeps: PendingDep[] = [];

    const api: IGeneratorAPI = {
        prompt: <T extends Record<string, any>>(questions: any[]) =>
            enquirer.prompt(questions) as Promise<T>,

        log: (message: string) => logger.done(message),

        addDependency(pkgName: string, version = "latest", dev = false) {
            pendingDeps.push({ pkgName, version, dev });
        },
    };

    // 挂载 pending deps，供 invokeGenerator 完成后写入 package.json
    (api as any).__pendingDeps = pendingDeps;

    return api;
}

/**
 * 将 pendingDeps 写入 context/package.json 的 dependencies / devDependencies。
 */
function flushDepsToPackageJson(context: string, deps: PendingDep[]): void {
    if (!deps.length) return;

    const pkgJsonPath = path.join(context, "package.json");
    if (!fs.existsSync(pkgJsonPath)) return;

    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

    for (const { pkgName, version, dev } of deps) {
        const field = dev ? "devDependencies" : "dependencies";
        pkgJson[field] = pkgJson[field] || {};
        pkgJson[field][pkgName] = version;
    }

    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n", "utf-8");
}

/**
 * 查找并调用插件的 generator。
 * generator 完成后，将 addDependency 声明的包写入 package.json。
 *
 * @returns 是否有新依赖写入（调用方可据此决定是否重新 install）
 */
export async function invokeGenerator(
    pkgName: string,
    context: string,
    api: IGeneratorAPI,
    logger: Logger,
): Promise<boolean> {
    try {
        const require = createRequire(import.meta.url);
        // 解析策略：
        //  1. 先 resolve `${pkgName}/package.json`，找到插件包根目录
        //  2. 从包根目录拼接 generator/index.ts（源文件）或 generator/index.js（编译产物）
        //  3. 用 jiti 加载，支持 .ts 源文件和 .js 产物
        const searchPaths = [
            context,
            path.dirname(fileURLToPath(import.meta.url)),
        ];
        let generatorPath: string | undefined;
        for (const searchDir of searchPaths) {
            try {
                const pkgJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [searchDir] });
                const pkgRoot = path.dirname(pkgJsonPath);
                // 按优先级依次尝试：.ts（monorepo 源码）→ .js → .cjs → .mjs
                for (const candidate of [
                    path.join(pkgRoot, "generator", "index.ts"),
                    path.join(pkgRoot, "generator", "index.js"),
                    path.join(pkgRoot, "generator", "index.cjs"),
                    path.join(pkgRoot, "generator", "index.mjs"),
                ]) {
                    if (fs.existsSync(candidate)) {
                        generatorPath = candidate;
                        break;
                    }
                }
                if (generatorPath) break;
            } catch {
                // 继续下一个查找路径
            }
        }
        if (!generatorPath) throw Object.assign(new Error("Not found"), { code: "MODULE_NOT_FOUND" });

        // 使用 jiti 加载，支持 .ts 源文件形式的 generator（monorepo workspace 场景）；
        // 已编译产物（.js / .cjs / .mjs）同样能正常加载。
        const jiti = createJiti(import.meta.url);
        const mod = jiti(generatorPath) as any;
        const generate = mod.default ?? mod;

        if (typeof generate !== "function") {
            logger.warn(`${pkgName} 的 generator 不是函数，跳过`);
            return false;
        }

        await generate(context, api);

        // 将 addDependency 声明的依赖写入 package.json
        const pendingDeps: PendingDep[] = (api as any).__pendingDeps ?? [];
        flushDepsToPackageJson(context, pendingDeps);

        return pendingDeps.length > 0;
    } catch (e: any) {
        if (e?.code === "MODULE_NOT_FOUND") {
            logger.warn(`${pkgName} 未提供 generator，跳过`);
        } else {
            logger.error(`generator 执行失败: ${e?.message ?? e}`);
        }
        return false;
    }
}
