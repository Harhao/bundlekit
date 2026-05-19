import path from "path";
import { rollup, watch, RollupOptions } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import babel from "@rollup/plugin-babel";
import image from "@rollup/plugin-image";
import postcss from "rollup-plugin-postcss";

import { Logger, validateBuildConfig, FileManager } from "@devkit/shared-utils";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv } from "@devkit/shared-utils";

export default class rollupBundler implements IBuildToolAdapter<RollupOptions> {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    private fse: FileManager;
    public name: string = "@devkit/bundler-rollup";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode = mode;
        this.context = api.context || process.cwd();
        this.fse = new FileManager(this.context);
    }

    public transformConfig(config: IBuildConfig): RollupOptions {
        const extensions = [".js", ".jsx", ".ts", ".tsx"];
        const rawEnvConfig = (config.config?.[this.mode] || config.config?.development || {}) as Record<string, any>;

        const entry = rawEnvConfig.entry
            ? (typeof rawEnvConfig.entry === "string"
                ? rawEnvConfig.entry
                : Object.values(rawEnvConfig.entry)[0])
            : path.resolve(this.context, "src/index.ts");

        const outDir = (rawEnvConfig.output && !Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output.dir : undefined)
            || (Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output[0]?.dir : undefined)
            || "dist";

        const cssConfig = rawEnvConfig.css || {};

        return {
            input: path.resolve(this.context, String(entry)),
            output: {
                file: path.resolve(this.context, outDir, "index.js"),
                format: "es",
                sourcemap: rawEnvConfig.js?.sourcemap || false,
            },
            plugins: [
                nodeResolve({ extensions, preferBuiltins: false }),
                commonjs(),
                image(),
                postcss({
                    extract: cssConfig.extract || false,
                    modules: cssConfig.modules || false,
                    sourceMap: cssConfig.sourcemap || false,
                    use: [
                        ...(cssConfig.loaders?.includes("less") ? ["less"] : []),
                        ...(cssConfig.loaders?.includes("sass") || cssConfig.loaders?.includes("scss") ? ["sass"] : []),
                    ],
                }),
                typescript({
                    tsconfig: path.resolve(this.context, "tsconfig.json"),
                }),
                babel({
                    babelHelpers: "bundled",
                    extensions,
                    presets: [
                        ["@babel/preset-env", { modules: false }],
                        "@babel/preset-typescript",
                    ],
                }),
            ],
            external: [],
        };
    }

    public validateConfig(config: RollupOptions, buildConfig?: IBuildConfig) {
        if (buildConfig) return validateBuildConfig(buildConfig, this.mode).valid;
        return true;
    }

    public async run(config: RollupOptions) {
        try {
            this.logger.info(`开始使用rollup进行打包`);
            switch (this.mode) {
                case "development": {
                    const watcher = watch({
                        ...config,
                        watch: { clearScreen: false, exclude: "node_modules/**" },
                    } as any);
                    watcher.on("event", (event: any) => {
                        if (event.code === "START") {
                            this.logger.log("rollup 开始重新构建...", "rollup");
                        } else if (event.code === "END") {
                            this.logger.done("rollup 构建完成", "rollup");
                        } else if (event.code === "ERROR") {
                            this.logger.error(`rollup 构建错误: ${event.error}`, "rollup");
                        }
                    });
                    break;
                }
                case "production":
                case "test":
                case "staging":
                case "gray": {
                    const bundle = await rollup(config);
                    await bundle.write(config.output as any);
                    this.logger.done("rollup 生产构建完成", "rollup");
                    await bundle.close();
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
