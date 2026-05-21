import { Logger, Spinner } from "@devkit/shared-utils";
import {
    validateProject,
    resolveTemplateDir,
    resolvePluginPkgName,
    renderTemplates,
    injectBundlerToDeps,
    normalizeProjectDeps,
    installDeps,
    runGenerator,
    resolveDepMode,
    PMName,
} from "./actions";

/**
 * 非 TTY / fallback 路径下的 create 实现
 *
 * TTY 路径请使用 `lib/ui/CreateApp.tsx`，由 ink 渲染步骤式 UI。
 * 两条路径共享同一组 actions（lib/commands/create/actions.ts）。
 */
export class Creator {
    private logger: Logger;

    constructor() {
        this.logger = new Logger();
    }

    async create(name: string, options: Record<string, any> = {}) {
        const spinner = new Spinner();
        const cwd = options.cwd || process.cwd();
        const template = options.template || "react-ts";
        const bundler = options.bundler || "webpack";
        const pm = (options.pm as PMName | undefined) || undefined;
        const depMode = resolveDepMode(cwd);

        let targetDir: string;
        try {
            ({ targetDir } = validateProject(name, cwd));
        } catch (err) {
            this.logger.error((err as Error).message);
            process.exit(1);
        }

        // 1. 渲染模板文件
        spinner.logWithSpinner("📦", `正在创建项目 ${name}...`);
        const templateDir = resolveTemplateDir(template);
        await renderTemplates({
            targetDir,
            templateDir,
            projectName: name,
            description: options.description,
            bundler,
            ssr: !!options.ssr,
        });

        // 2. 规范化依赖版本（替换 workspace:^ 为 ^cliVersion）
        normalizeProjectDeps(targetDir, depMode);
        this.logger.info(`依赖模式：npm 模式（^${depMode.cliVersion}）`);

        // 3. 把所选 bundler 写入新项目的 devDependencies
        const written = injectBundlerToDeps(targetDir, bundler, depMode);
        if (written) {
            const [pkgName, version] = written;
            this.logger.info(`已写入 ${pkgName}@${version} 到 devDependencies`);
        } else {
            this.logger.warn(`bundler "${bundler}" 不在内置列表中，跳过 devDeps 写入`);
        }

        // 4. 安装基础依赖
        spinner.logWithSpinner("📦", "正在安装依赖...");
        await installDeps(targetDir, { pm });
        spinner.stopSpinner(false);

        this.logger.done(`项目 ${name} 创建成功！`);

        // 5. 调用框架插件 generator（legacy 路径也禁止 generator 另起 prompt）
        const prevNoPrompt = process.env.DEVKIT_NO_PROMPT;
        process.env.DEVKIT_NO_PROMPT = "1";
        let hasPendingDeps = false;
        try {
            const pluginPkgName = resolvePluginPkgName(template);
            hasPendingDeps = await runGenerator(pluginPkgName, targetDir, this.logger);
        } finally {
            if (prevNoPrompt === undefined) {
                delete process.env.DEVKIT_NO_PROMPT;
            } else {
                process.env.DEVKIT_NO_PROMPT = prevNoPrompt;
            }
        }

        // 6. generator 可能追加了 workspace:^ 依赖，再 normalize 一次
        if (hasPendingDeps) {
            normalizeProjectDeps(targetDir, depMode);
            this.logger.info("正在安装追加的依赖...");
            await installDeps(targetDir, { pm });
        }

        const runDev = pm === "npm" ? "npm run dev" : `${pm || "pnpm"} dev`;
        this.logger.log(`\n  cd ${name}`);
        this.logger.log(`  ${runDev}\n`);
    }
}
