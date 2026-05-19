import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { FileManager, Logger, Spinner, PackageManager } from "@devkit/shared-utils";
import Generator from "../../generator";
import { buildGeneratorAPI, invokeGenerator } from "../../utils/generatorRunner";

export class Creator {
    private logger: Logger;
    private fileManager: FileManager;

    constructor() {
        this.logger = new Logger();
        this.fileManager = new FileManager(process.cwd());
    }

    async create(name: string, options: Record<string, any> = {}) {
        const spinner = new Spinner();
        const cwd = options.cwd || process.cwd();
        const targetDir = path.resolve(cwd, name);
        const template = options.template || "react-ts";
        const bundler = options.bundler || "webpack";

        if (this.fileManager.isFilePathExist(targetDir)) {
            this.logger.error(`目录 ${targetDir} 已存在，请选择其他项目名称`);
            process.exit(1);
        }

        if (!/^[a-z0-9@.\-_]+$/.test(name)) {
            this.logger.error(`项目名称 "${name}" 不合法，只能包含小写字母、数字、@、.、-、_`);
            process.exit(1);
        }

        // 1. 渲染模板文件
        spinner.logWithSpinner("📦", `正在创建项目 ${name}...`);
        const templateDir = this.resolveTemplateDir(template);
        const generator = new Generator({
            templateDir,
            targetDir,
            context: { projectName: name, description: options.description || "", bundler },
        });
        await generator.generate();

        // 2. 安装基础依赖
        spinner.logWithSpinner("📦", "正在安装依赖...");
        const pm = new PackageManager({ context: targetDir });
        await pm.add("", { noSave: true });
        spinner.stopSpinner(false);

        this.logger.done(`项目 ${name} 创建成功！`);

        // 3. 调用框架插件 generator（询问可选项，写入 package.json）
        const pluginPkgName = this.resolvePluginPkgName(template);
        const api = buildGeneratorAPI(targetDir, this.logger);
        const hasPendingDeps = await invokeGenerator(pluginPkgName, targetDir, api, this.logger);

        // 4. 若 generator 追加了新依赖，重新安装
        if (hasPendingDeps) {
            this.logger.info("正在安装追加的依赖...");
            const pm2 = new PackageManager({ context: targetDir });
            await pm2.install();
        }

        this.logger.log(`\n  cd ${name}`);
        this.logger.log(`  pnpm dev\n`);
    }

    /** 根据模板名推断对应的框架构建插件包名 */
    private resolvePluginPkgName(template: string): string {
        const normalized = this.normalizeTemplate(template);
        return normalized.startsWith("vue") ? "@devkit/plugin-vue" : "@devkit/plugin-react";
    }

    private normalizeTemplate(template: string): string {
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

    private resolveTemplateDir(template: string): string {
        const normalized = this.normalizeTemplate(template);
        const pluginPkgName = this.resolvePluginPkgName(template);

        // 方案1：require.resolve 找插件包（npm install / pnpm workspace 均适用）
        try {
            const require = createRequire(import.meta.url);
            const pkgJsonPath = require.resolve(`${pluginPkgName}/package.json`, {
                paths: [process.cwd()],
            });
            const templateDir = path.join(path.dirname(pkgJsonPath), "templates", `template-${normalized}`);
            if (fs.existsSync(templateDir)) return templateDir;
        } catch {}

        // 方案2：相对 import.meta.url 向上找 monorepo packages 目录（开发环境兜底）
        const __dir = path.dirname(fileURLToPath(import.meta.url));
        const pluginDirName = pluginPkgName.replace("@devkit/", "devkit-");
        const monorepoDir = path.resolve(__dir, "../..", pluginDirName, "templates", `template-${normalized}`);
        if (fs.existsSync(monorepoDir)) return monorepoDir;

        const available = ["react-ts", "react-js", "vue3-ts", "vue3-js"];
        this.logger.error(`模板 "${template}" 未找到，可用模板：${available.join(" / ")}`);
        process.exit(1);
    }
}
