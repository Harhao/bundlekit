import path from "path";
import { existsSync, readFileSync } from "fs";
import { rollup, watch, RollupOptions, OutputOptions, Plugin } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import babel from "@rollup/plugin-babel";
import image from "@rollup/plugin-image";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import postcss from "rollup-plugin-postcss";

import { Logger, validateBuildConfig, FileManager } from "@devkit/shared-utils";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv } from "@devkit/shared-utils";
import { DevServer } from "./DevServer";

// ─── 格式后缀映射（library 模式多格式输出） ────────────────────────────────────────
const FORMAT_SUFFIX: Record<string, string> = {
    es:        ".mjs",
    esm:       ".mjs",
    cjs:       ".cjs",
    commonjs:  ".cjs",
    umd:       ".umd.js",
    iife:      ".iife.js",
};

// rollup format 标准化
const toRollupFormat = (fmt: string): OutputOptions["format"] => {
    const map: Record<string, OutputOptions["format"]> = {
        commonjs: "cjs",
        esm:      "es",
        es:       "es",
        cjs:      "cjs",
        umd:      "umd",
        iife:     "iife",
    };
    return map[fmt] ?? "es";
};

// ─── 内联 HTML 生成插件（应用模式，无需额外依赖） ─────────────────────────────────────
function htmlGeneratorPlugin(options: {
    context: string;
    template?: string;
    filename: string;
    inject: "head" | "body";
}): Plugin {
    return {
        name: "devkit-html",
        generateBundle(_, bundle) {
            // ── 收集 JS chunk 和 CSS asset ────────────────────────────────────
            const scriptFiles = Object.keys(bundle)
                .filter((k) => (bundle[k] as any).type === "chunk")
                .map((k) => path.basename(k));

            // postcss extract:true 会把 CSS 作为 rollup asset 写入 bundle
            const cssFiles = Object.keys(bundle)
                .filter((k) => (bundle[k] as any).type === "asset" && k.endsWith(".css"))
                .map((k) => path.basename(k));

            const linkTags   = cssFiles.map((c) => `  <link rel="stylesheet" href="${c}">`).join("\n");
            const scriptTags = scriptFiles.map((s) => `  <script src="${s}"></script>`).join("\n");

            // ── 生成 HTML ─────────────────────────────────────────────────────
            let html: string;
            const tplPath = options.template
                ? path.resolve(options.context, options.template)
                : null;

            if (tplPath && existsSync(tplPath)) {
                html = readFileSync(tplPath, "utf-8");
                // CSS link 注入 <head>（无论 inject 选项）
                if (linkTags) {
                    html = html.includes("</head>")
                        ? html.replace("</head>", `${linkTags}\n</head>`)
                        : linkTags + "\n" + html;
                }
                // JS script 按 inject 选项注入
                const closeTag = options.inject === "head" ? "</head>" : "</body>";
                html = html.includes(closeTag)
                    ? html.replace(closeTag, `${scriptTags}\n${closeTag}`)
                    : html + scriptTags;
            } else {
                // 无模板：生成最简骨架，CSS 放 head，JS 放 body（符合最佳实践）
                html = [
                    "<!DOCTYPE html>",
                    '<html lang="en">',
                    "<head>",
                    '  <meta charset="UTF-8">',
                    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
                    "  <title>App</title>",
                    ...(linkTags   ? [linkTags]   : []),
                    ...(options.inject === "head" ? [scriptTags] : []),
                    "</head>",
                    "<body>",
                    '  <div id="root"></div>',
                    ...(options.inject !== "head" ? [scriptTags] : []),
                    "</body>",
                    "</html>",
                ].join("\n");
            }

            this.emitFile({ type: "asset", fileName: options.filename, source: html });
        },
    };
}

// ─── rollup 合法 InputOptions 白名单（来自 rollup 错误提示）──────────────────────
// changeConfigure 用户钩子可能注入 webpack 专有字段（如 devtool），需在运行前剔除
const ROLLUP_VALID_INPUT_KEYS = new Set<string>([
    "cache", "context", "experimentalCacheExpiry", "experimentalLogSideEffects",
    "external", "fs", "input", "jsx", "logLevel", "makeAbsoluteExternalsRelative",
    "maxParallelFileOps", "moduleContext", "onLog", "onwarn", "output", "perf",
    "plugins", "preserveEntrySignatures", "preserveSymlinks", "shimMissingExports",
    "strictDeprecations", "treeshake", "watch",
]);

function sanitizeRollupOptions(config: RollupOptions): RollupOptions {
    return Object.fromEntries(
        Object.entries(config).filter(([k]) => ROLLUP_VALID_INPUT_KEYS.has(k)),
    ) as RollupOptions;
}

// ─── 运行时保留的 devServer 配置（在 transformConfig 阶段解析，run 阶段使用）──────
interface StoredDevServerConfig {
    host: string;
    port: number;
    open: boolean;
    proxy: Record<string, any>;
    outDir: string;
    library: boolean;
}

export default class rollupBundler implements IBuildToolAdapter<RollupOptions> {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    private fse: FileManager;
    /** transformConfig 阶段存储，run 阶段使用 */
    private devServerConfig: StoredDevServerConfig | null = null;
    public name: string = "@devkit/bundler-rollup";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode    = mode;
        this.context = api.context || process.cwd();
        this.fse     = new FileManager(this.context);
    }

    public transformConfig(config: IBuildConfig): RollupOptions {
        const extensions   = [".js", ".jsx", ".ts", ".tsx"];
        const rawEnvConfig = (config.config?.[this.mode] || config.config?.development || {}) as Record<string, any>;

        // ── Entry ──────────────────────────────────────────────────────────────
        const entry = rawEnvConfig.entry
            ? (typeof rawEnvConfig.entry === "string"
                ? rawEnvConfig.entry
                : Object.values(rawEnvConfig.entry)[0])
            : path.resolve(this.context, "src/index.ts");

        // ── Output dir ────────────────────────────────────────────────────────
        const outDir = (rawEnvConfig.output && !Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output.dir : undefined)
            || (Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output[0]?.dir : undefined)
            || "dist";
        const resolvedOutDir = path.resolve(this.context, outDir);

        // ── CSS config ────────────────────────────────────────────────────────
        const cssConfig = rawEnvConfig.css || {};

        // ── Library mode ──────────────────────────────────────────────────────
        const isLibrary   = rawEnvConfig.library === true;
        const libraryName = rawEnvConfig.libraryName as string | undefined;

        // ── Formats ───────────────────────────────────────────────────────────
        const fmtRaw = rawEnvConfig.output?.formats;
        const fmtArr: string[] = Array.isArray(fmtRaw) ? fmtRaw : [fmtRaw || "es"];

        // ── Base filename ─────────────────────────────────────────────────────
        const rawFilename    = rawEnvConfig.output?.filename || "index.js";
        // 应用模式：去掉 webpack 模板变量（如 [contenthash:8]）
        const singleFilename = /\[.+?\]/.test(rawFilename) ? "index.js" : rawFilename;
        // 类库模式：去掉扩展名作为 base name
        const baseName       = rawFilename.replace(/\[.+?\]/g, "").replace(/\.[^.]+$/, "") || "index";

        // ── Plugins ───────────────────────────────────────────────────────────
        const nodeEnv = this.mode === "production" ? "production" : "development";
        const plugins: Plugin[] = [
            // replace 必须排在最前，替换编译期常量：
            //  - process.env.NODE_ENV : CRA/React 等使用
            //  - import.meta.env.*    : Vite 生态（zustand/jotai 等）在 UMD 格式下会触发 EMPTY_IMPORT_META 警告
            //
            // 注意：@rollup/plugin-replace 默认使用 \b(?!\.) 尾分隔符，
            // 因此 "import.meta.env" 不会匹配 "import.meta.env.MODE"（后者有额外的 .xxx），
            // 需要分开列出，plugin 内部会按最长键优先排序确保无歧义。
            replace({
                preventAssignment: true,
                values: {
                    "process.env.NODE_ENV":    JSON.stringify(nodeEnv),
                    "import.meta.env.MODE":    JSON.stringify(nodeEnv),
                    "import.meta.env.PROD":    String(nodeEnv === "production"),
                    "import.meta.env.DEV":     String(nodeEnv !== "production"),
                    "import.meta.env.SSR":     "false",
                    // 最通用的 fallback：import.meta.env 整体（用于三元表达式守卫）
                    "import.meta.env": JSON.stringify({
                        MODE: nodeEnv,
                        DEV:  nodeEnv !== "production",
                        PROD: nodeEnv === "production",
                        SSR:  false,
                    }),
                },
            }),
            // browser:true → 优先使用 package.json 的 browser 字段，
            // 使 axios 等包解析到浏览器版本，消除 Node 内置模块警告
            nodeResolve({ extensions, browser: true, preferBuiltins: false }),
            commonjs(),
            json(),
            image(),
            postcss({
                extract:   cssConfig.extract  || false,
                modules:   cssConfig.modules  || false,
                sourceMap: cssConfig.sourcemap || false,
                use: [
                    ...(cssConfig.loaders?.includes("less") ? ["less"] : []),
                    ...(cssConfig.loaders?.includes("sass") || cssConfig.loaders?.includes("scss") ? ["sass"] : []),
                ],
            }),
            typescript({
                tsconfig:    path.resolve(this.context, "tsconfig.json"),
                outDir:      resolvedOutDir,
                declaration: isLibrary,
                noEmit:      false,
                // 与 rollup output.sourcemap 保持一致，避免 "Rollup 'sourcemap' option must be set" 警告
                sourceMap:   rawEnvConfig.js?.sourcemap ?? false,
            }),
            babel({
                babelHelpers: "bundled",
                extensions,
                // 排除 node_modules：第三方包已是浏览器兼容产物，不需要 babel 再次转译；
                // 同时避免处理超大文件（如 react-dom.development.js）触发 babel 性能降级警告
                exclude: ["node_modules/**"],
                presets: [
                    ["@babel/preset-env", { modules: false }],
                    "@babel/preset-typescript",
                ],
            }),
        ];

        // 应用模式：注入 HTML 生成插件
        if (!isLibrary) {
            const pages = rawEnvConfig.pages as Array<{
                template?: string;
                filename?: string;
                inject?: "head" | "body";
            }> | undefined;
            const page = pages?.[0];
            plugins.push(
                htmlGeneratorPlugin({
                    context:  this.context,
                    template: page?.template,
                    filename: page?.filename || "index.html",
                    inject:   page?.inject   || "body",
                }),
            );
        }

        const external = rawEnvConfig.externals || [];

        // ── Build output config ───────────────────────────────────────────────
        let output: OutputOptions | OutputOptions[];

        if (isLibrary && fmtArr.length > 1) {
            // 类库多格式输出
            output = fmtArr.map((fmt): OutputOptions => {
                const rollupFmt = toRollupFormat(fmt);
                const suffix    = FORMAT_SUFFIX[fmt] ?? ".js";
                return {
                    file:                 path.resolve(resolvedOutDir, `${baseName}${suffix}`),
                    format:               rollupFmt,
                    sourcemap:            rawEnvConfig.js?.sourcemap || false,
                    name:                 ["umd", "iife"].includes(rollupFmt as string)
                        ? (libraryName || path.basename(String(entry), path.extname(String(entry))))
                        : undefined,
                    inlineDynamicImports: ["umd", "iife"].includes(rollupFmt as string),
                    exports:              "named",
                };
            });
        } else {
            // 单格式（应用 / 单格式类库）
            const primaryFmt = fmtArr[0] ?? "es";
            const rollupFmt  = toRollupFormat(primaryFmt);
            output = {
                file:                 path.resolve(resolvedOutDir, isLibrary
                    ? `${baseName}${FORMAT_SUFFIX[primaryFmt] ?? ".js"}`
                    : singleFilename),
                format:               rollupFmt,
                sourcemap:            rawEnvConfig.js?.sourcemap || false,
                name:                 ["umd", "iife"].includes(rollupFmt as string)
                    ? (libraryName || path.basename(String(entry), path.extname(String(entry))))
                    : undefined,
                inlineDynamicImports: ["umd", "iife"].includes(rollupFmt as string),
            };
        }

        // 存储 devServer 配置供 run() 使用（避免污染 RollupOptions）
        this.devServerConfig = {
            host:    rawEnvConfig.devServer?.host  ?? "0.0.0.0",
            port:    rawEnvConfig.devServer?.port  ?? 3000,
            open:    rawEnvConfig.devServer?.open  ?? false,
            proxy:   rawEnvConfig.devServer?.proxy ?? {},
            outDir:  resolvedOutDir,
            library: isLibrary,
        };

        return {
            input:    path.resolve(this.context, String(entry)),
            output,
            plugins,
            external,
        };
    }

    public validateConfig(config: RollupOptions, buildConfig?: IBuildConfig) {
        if (buildConfig) return validateBuildConfig(buildConfig, this.mode).valid;
        return true;
    }

    public async run(config: RollupOptions) {
        try {
            this.logger.info("开始使用rollup进行打包");
            switch (this.mode) {
                case "development": await this.devBuild(config);  break;
                case "production":
                case "test":
                case "staging":
                case "gray":        await this.prodBuild(config); break;
                default: break;
            }
        } catch (e) {
            this.logger.error(`打包失败, 错误信息: ${e}`);
            throw e;
        }
    }

    // ─── Development build：watch + optional dev server ──────────────────────────
    private async devBuild(config: RollupOptions): Promise<void> {
        const devCfg    = this.devServerConfig;
        const isLibrary = devCfg?.library ?? false;
        // 过滤 changeConfigure 钩子可能注入的 webpack 专有字段（如 devtool）
        const safeConfig = sanitizeRollupOptions(config);

        const watcher = watch({
            ...safeConfig,
            watch: { clearScreen: false, exclude: "node_modules/**" },
        } as any);

        if (isLibrary) {
            // 类库模式：仅 watch，不启动 dev server
            this.logger.info("rollup library watch 模式已启动", "rollup");
            watcher.on("event", (event: any) => {
                if (event.code === "START")  this.logger.log("rollup 开始重新构建...", "rollup");
                if (event.code === "END")    this.logger.done("rollup 构建完成", "rollup");
                if (event.code === "ERROR")  this.logger.error(`rollup 构建错误: ${event.error}`, "rollup");
                if (event.result)            event.result.close();
            });
            return;
        }

        // 应用模式：首次构建完成后启动 dev server，后续构建触发 livereload
        const server = new DevServer(
            {
                host:   devCfg?.host   ?? "0.0.0.0",
                port:   devCfg?.port   ?? 3000,
                outDir: devCfg?.outDir ?? path.resolve(this.context, "dist"),
                open:   devCfg?.open   ?? false,
                proxy:  devCfg?.proxy  ?? {},
            },
            this.logger,
        );

        await new Promise<void>((resolve) => {
            let serverStarted = false;
            watcher.on("event", async (event: any) => {
                if (event.code === "START") {
                    this.logger.log("rollup 开始重新构建...", "rollup");
                }
                if (event.code === "END") {
                    this.logger.done("rollup 构建完成", "rollup");
                    if (!serverStarted) {
                        serverStarted = true;
                        await server.start();
                        resolve();
                    } else {
                        server.reload();   // 后续构建：触发浏览器 livereload
                    }
                }
                if (event.code === "ERROR") {
                    this.logger.error(`rollup 构建错误: ${event.error}`, "rollup");
                    if (!serverStarted) resolve();
                }
                if (event.result) event.result.close();
            });
        });
    }

    // ─── Production build ────────────────────────────────────────────────────────
    private async prodBuild(config: RollupOptions): Promise<void> {
        // 过滤 changeConfigure 钩子可能注入的 webpack 专有字段（如 devtool）
        const safeConfig = sanitizeRollupOptions(config);
        const bundle  = await rollup(safeConfig);
        const outputs = Array.isArray(safeConfig.output)
            ? safeConfig.output
            : [safeConfig.output as OutputOptions];
        for (const out of outputs) {
            await bundle.write(out);
        }
        this.logger.done("rollup 生产构建完成", "rollup");
        await bundle.close();
    }
}
