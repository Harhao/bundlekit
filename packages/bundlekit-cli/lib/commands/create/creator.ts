import { Logger, Spinner } from "@bundlekit/shared-utils";
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

        // node-ts 模板不支持 SSR — 防御性二道关。CLI 入口也有相同检查，但
        // Creator 是更稳定的对外契约（直接 import 调用时还得有这一层）。
        if (template === "node-ts" && options.ssr === true) {
            this.logger.error(
                "node-ts 模板不支持 SSR。\n" +
                "  - node-ts 是 Node.js 库 / 服务模板，无 HTML 入口、无 hydration 概念\n" +
                "  - 如需 SSR，请改用 react-ts / react-js / vue3-ts / vue3-js 之一",
            );
            throw new Error("node-ts 模板不支持 SSR");
        }

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
            // commander 把 --lib 转成 options.lib（兼容 options.library 兜底）
            library: !!(options.lib ?? options.library),
            libraryName: options.libraryName,
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

        // 4. 安装基础依赖（DEVKIT_SKIP_INSTALL=1 跳过）
        const skipInstall = process.env.DEVKIT_SKIP_INSTALL === "1";
        if (!skipInstall) {
            spinner.logWithSpinner("📦", "正在安装依赖...");
            await installDeps(targetDir, { pm });
            spinner.stopSpinner(false);
        }

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
            if (!skipInstall) {
                this.logger.info("正在安装追加的依赖...");
                await installDeps(targetDir, { pm });
            }
        }

        const runDev = pm === "npm" ? "npm run dev" : `${pm || "pnpm"} dev`;
        this.logger.log(`\n  cd ${name}`);
        this.logger.log(`  ${runDev}\n`);
    }
}
