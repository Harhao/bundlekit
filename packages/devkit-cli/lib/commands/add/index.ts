import { PackageManager, Logger } from "@devkit/shared-utils";
import { buildGeneratorAPI, invokeGenerator } from "../../utils/generatorRunner";
const PLUGIN_MAP: Record<string, string> = {
    mock:    "@devkit/plugin-mock",
    react:   "@devkit/plugin-react",
    vue:     "@devkit/plugin-vue",
    request: "@devkit/request",
};

function isBuildPlugin(pkgName: string): boolean {
    return /\/plugin-|^plugin-/.test(pkgName);
}

function resolvePackageName(input: string): string {
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

        this.logger.info(`解析插件: ${rawInput} → ${pkgName}`);
        this.logger.info(`类型: ${buildPlugin ? "构建插件（devDependency）" : "运行时库（dependency）"}`);

        const pm = new PackageManager({ context: this.context });
        const installed = await pm.add(pkgName, { dev: buildPlugin });

        if (!installed) {
            this.logger.error(`安装 ${pkgName} 失败`);
            return;
        }

        this.logger.done(`已安装 ${pkgName}`);

        if (buildPlugin) {
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
