import path from "path";
import { rolldown, build, watch } from "rolldown";

import { Logger, validateBuildConfig } from "@devkit/shared-utils";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv } from "@devkit/shared-utils";

export default class RolldownBundler implements IBuildToolAdapter {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    public name: string = "@devkit/bundler-rolldown";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode = mode;
        this.context = api.context || process.cwd();
    }

    public transformConfig(config: IBuildConfig) {
        const rawEnvConfig = (config.config?.[this.mode] || config.config?.development || {}) as Record<string, any>;

        const entry = rawEnvConfig.entry
            ? (typeof rawEnvConfig.entry === "string"
                ? { app: rawEnvConfig.entry }
                : rawEnvConfig.entry)
            : { app: path.resolve(this.context, "src/index.tsx") };

        const resolvedInput: Record<string, string> = {};
        for (const [key, val] of Object.entries(entry)) {
            resolvedInput[key] = path.resolve(this.context, String(val));
        }

        const outDir = (rawEnvConfig.output && !Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output.dir : undefined)
            || (Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output[0]?.dir : undefined)
            || "dist";

        const alias = rawEnvConfig.alias || {};
        const jsConfig = rawEnvConfig.js || {};

        this.logger.info(`开始转换rolldown配置`);

        const fmt = rawEnvConfig.output?.formats;
        const primaryFormat = Array.isArray(fmt) ? fmt[0] : (fmt || "es");
        const rolldownFormat = primaryFormat === "commonjs" ? "cjs"
            : primaryFormat === "esm" ? "es"
            : (["es", "cjs", "umd", "iife"].includes(primaryFormat) ? primaryFormat : "es") as any;

        return {
            input: resolvedInput,
            output: {
                dir: path.resolve(this.context, outDir),
                format: rolldownFormat,
                sourcemap: jsConfig.sourcemap || false,
                entryFileNames: rawEnvConfig.output?.filename || "[name].js",
            },
            resolve: {
                extensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".less"],
                alias: Object.entries(alias).reduce((acc, [key, val]) => {
                    acc[key] = path.resolve(this.context, String(val));
                    return acc;
                }, {} as Record<string, string>),
            },
            platform: rawEnvConfig.target === "node" ? "node" : "browser",
            external: rawEnvConfig.externals || [],
            treeshake: rawEnvConfig.js?.splitChunks !== false,
            experimental: {
                enableComposingJsPlugins: true,
            },
        };
    }

    public validateConfig(config: any) {
        const result = validateBuildConfig(config as any, this.mode);
        if (!result.valid) {
            this.logger.error(`配置校验失败:\n${result.errors.join("\n")}`);
            return false;
        }
        return true;
    }

    public async run(config: any) {
        try {
            this.logger.info(`开始使用rolldown进行打包`);
            switch (this.mode) {
                case "development": {
                    const watcher = await watch({
                        ...config,
                        watch: true,
                    });
                    this.logger.done("rolldown watch 模式已启动", "rolldown");
                    watcher.on("event", (event: any) => {
                        if (event?.code === "BUNDLE_END") {
                            this.logger.done("rolldown 构建完成", "rolldown");
                        } else if (event?.code === "ERROR") {
                            this.logger.error(`rolldown 构建错误: ${event.error}`, "rolldown");
                        }
                    });
                    break;
                }
                case "production":
                case "test":
                case "staging":
                case "gray": {
                    const result = await build(config);
                    const output = (result as any).output || [];
                    const stats = output
                        .filter((o: any) => o.type === "chunk")
                        .map((c: any) => `  ${c.fileName}`)
                        .join("\n");
                    this.logger.done(`rolldown 生产构建完成\n${stats}`, "rolldown");
                    break;
                }
                default:
                    break;
            }
        } catch (e) {
            this.logger.error(`打包失败, 错误信息: ${e}`);
            throw e;
        }
    }
}
