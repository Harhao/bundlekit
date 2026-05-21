import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { FileManager, Logger, PackageManager } from "@devkit/shared-utils";
import Generator from "../../generator";
import { buildGeneratorAPI, invokeGenerator } from "../../utils/generatorRunner";
import { addBundlerToDevDeps } from "../../utils/projectMutation";

export interface ICreateOptions {
    name: string;
    template: string;
    bundler: string;
    description?: string;
    cwd?: string;
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
    return normalized.startsWith("vue") ? "@devkit/plugin-vue" : "@devkit/plugin-react";
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
        const pkgJsonPath = require.resolve(`${pluginPkgName}/package.json`, {
            paths: [process.cwd()],
        });
        const templateDir = path.join(path.dirname(pkgJsonPath), "templates", `template-${normalized}`);
        if (fs.existsSync(templateDir)) return templateDir;
    } catch {}

    const __dir = path.dirname(fileURLToPath(import.meta.url));
    const pluginDirName = pluginPkgName.replace("@devkit/", "devkit-");
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
}): Promise<void> {
    const generator = new Generator({
        templateDir: opts.templateDir,
        targetDir: opts.targetDir,
        context: {
            projectName: opts.projectName,
            description: opts.description || "",
            bundler: opts.bundler,
        },
    });
    await generator.generate();
}

/** 把所选 bundler 写入 targetDir/package.json 的 devDependencies */
export function injectBundlerToDeps(targetDir: string, bundler: string): [string, string] | null {
    return addBundlerToDevDeps(targetDir, bundler);
}

/** 安装 targetDir 下的所有 deps */
export async function installDeps(targetDir: string): Promise<void> {
    const pm = new PackageManager({ context: targetDir });
    await pm.install();
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
