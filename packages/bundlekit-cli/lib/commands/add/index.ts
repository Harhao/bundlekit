import { PackageManager, Logger, resolveBundlerName, BUNDLER_PACKAGE_MAP } from "@bundlekit/shared-utils";
import { buildGeneratorAPI, invokeGenerator } from "../../utils/generatorRunner";
const PLUGIN_MAP: Record<string, string> = {
    mock:    "@bundlekit/plugin-mock",
    react:   "@bundlekit/plugin-react",
    vue:     "@bundlekit/plugin-vue",
    request: "@bundlekit/request",
};

function isBuildPlugin(pkgName: string): boolean {
    return /\/plugin-|^plugin-/.test(pkgName);
}

function isBundlerPackage(pkgName: string): boolean {
    return /^@bundlekit\/bundler-/.test(pkgName);
}

function resolvePackageName(input: string): string {
    // 1) 优先按 bundler 短名解析（vite / bundler-vite / @bundlekit/bundler-vite）
    const bundlerPkg = (() => {
        const name = resolveBundlerName(input);
        return name ? BUNDLER_PACKAGE_MAP[name] : null;
    })();
    if (bundlerPkg) return bundlerPkg;

    // 2) 其次按已有 PLUGIN_MAP 解析（兼容 react / vue / mock / request）
    const [name] = input.split("@").filter(Boolean);
    return PLUGIN_MAP[name] ?? input;
}

export class AddCommand {
    private logger: Logger;
    private context: string;

    constructor(context?: string) {
        this.context = context || process.cwd();
        this.logger = new Logger();
    }

    async add(rawInput: string): Promise<void> {
        const pkgName = resolvePackageName(rawInput);
        const buildPlugin = isBuildPlugin(pkgName);
        const bundlerPkg = isBundlerPackage(pkgName);
        const dev = buildPlugin || bundlerPkg;

        this.logger.info(`解析插件: ${rawInput} → ${pkgName}`);
        this.logger.info(
            `类型: ${
                bundlerPkg ? "构建工具适配器（devDependency）" :
                buildPlugin ? "构建插件（devDependency）" :
                "运行时库（dependency）"
            }`,
        );

        const pm = new PackageManager({ context: this.context });
        const installed = await pm.add(pkgName, { dev });

        if (!installed) {
            this.logger.error(`安装 ${pkgName} 失败`);
            return;
        }

        this.logger.done(`已安装 ${pkgName}`);

        // bundler 不走 generator 流程；只有构建插件才尝试调用 generator
        if (buildPlugin && !bundlerPkg) {
            const api = buildGeneratorAPI(this.context, this.logger);
            const hasPendingDeps = await invokeGenerator(pkgName, this.context, api, this.logger);
            if (hasPendingDeps) {
                this.logger.info("正在安装追加的依赖...");
                const pm2 = new PackageManager({ context: this.context });
                await pm2.install();
            }
        }
    }
}
