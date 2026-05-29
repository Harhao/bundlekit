import path from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { rollup, watch, RollupOptions, OutputOptions, Plugin } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import babel from "@rollup/plugin-babel";
import image from "@rollup/plugin-image";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import postcss from "rollup-plugin-postcss";

import { Logger, validateBuildConfig, FileManager, createSSRRequestHandler, buildSSRView, resolveSSRExternals, createStaticFileMiddleware } from "@bundlekit/shared-utils";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv, IRequestHandler, ISSRMiddlewareCtx } from "@bundlekit/shared-utils";
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

// ─── HTML 写入配置 ───────────────────────────────────────────────────────────────
interface HtmlWriteConfig {
    outDir: string;
    template?: string;
    filename: string;
    inject: "head" | "body";
    context: string;
    /** 入口文件名（如 "index.js"），用于 ES 格式只注入入口 chunk */
    entryFilename?: string;
    /** 输出格式（es/cjs/umd 等），决定 script 标签是否使用 type="module" */
    format?: string;
}

/** 根据配置生成并写入 index.html（显式写入磁盘，避免 emitFile 在 watch 模式下不可靠） */
function writeHtmlFile(opts: HtmlWriteConfig): void {
    let jsFiles:  string[] = [];
    let cssFiles: string[] = [];
    try {
        const files = readdirSync(opts.outDir);
        jsFiles  = files.filter((f) => /\.(js|mjs|cjs)$/.test(f) && !f.endsWith(".map"));
        cssFiles = files.filter((f) => f.endsWith(".css")         && !f.endsWith(".map"));
    } catch { /* outDir 不存在时静默跳过 */ }

    // ES 格式 + code-splitting：只注入入口 chunk（其他 chunk 由 import() 动态加载）
    const isESM = opts.format === "es";
    if (isESM && opts.entryFilename) {
        jsFiles = jsFiles.filter((f) => f === opts.entryFilename);
    }

    const linkTags   = cssFiles.map((c) => `  <link rel="stylesheet" href="${c}">`).join("\n");
    const scriptTags = jsFiles .map((s) => isESM
        ? `  <script type="module" src="${s}"></script>`
        : `  <script src="${s}"></script>`
    ).join("\n");

    let html: string;
    const tplPath = opts.template ? path.resolve(opts.context, opts.template) : null;

    if (tplPath && existsSync(tplPath)) {
        html = readFileSync(tplPath, "utf-8");
        if (linkTags) {
            html = html.includes("</head>")
                ? html.replace("</head>", `${linkTags}\n</head>`)
                : linkTags + "\n" + html;
        }
        const closeTag = opts.inject === "head" ? "</head>" : "</body>";
        html = html.includes(closeTag)
            ? html.replace(closeTag, `${scriptTags}\n${closeTag}`)
            : html + scriptTags;
    } else {
        html = [
            "<!DOCTYPE html>",
            '<html lang="en">',
            "<head>",
            '  <meta charset="UTF-8">',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
            "  <title>App</title>",
            ...(linkTags   ? [linkTags]   : []),
            ...(opts.inject === "head" ? [scriptTags] : []),
            "</head>",
            "<body>",
            '  <div id="root"></div>',
            ...(opts.inject !== "head" ? [scriptTags] : []),
            "</body>",
            "</html>",
        ].join("\n");
    }

    mkdirSync(opts.outDir, { recursive: true });
    writeFileSync(path.join(opts.outDir, opts.filename), html, "utf-8");
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
    private htmlWriteConfig: HtmlWriteConfig | null = null;
    public name: string = "@bundlekit/bundler-rollup";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode    = mode;
        this.context = api.context || process.cwd();
        this.fse     = new FileManager(this.context);
    }

    public async transformConfig(config: IBuildConfig): Promise<RollupOptions> {
        const rawEnvConfig = (config.config?.[this.mode] || config.config?.development || {}) as Record<string, any>;
        const framework    = rawEnvConfig.framework as string | undefined;
        const extensions   = framework === "vue3"
            ? [".js", ".jsx", ".ts", ".tsx", ".vue"]
            : [".js", ".jsx", ".ts", ".tsx"];

        // SSR server pass 检测
        const isServerPass = rawEnvConfig.__isServerPass === true;

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

        // 框架插件：Vue 3 SFC 支持。@vitejs/plugin-vue 是 rollup-API 兼容的，
        // 直接放到 rollup plugins 列表即可。dynamic import 失败时仅 warn。
        const frameworkPlugins: Plugin[] = [];
        if (framework === "vue3") {
            try {
                const { default: vue } = await import("@vitejs/plugin-vue");
                frameworkPlugins.push((vue as any)());
            } catch {
                this.logger.warn("framework 为 vue3 但未安装 @vitejs/plugin-vue，跳过");
            }
        }

        const plugins: Plugin[] = [
            ...frameworkPlugins,
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
            // 仅当工程含 tsconfig.json 时启用 @rollup/plugin-typescript；
            // JS-only 工程（react-js / vue3-js）改由 @babel/preset-typescript 兜底，
            // 避免 ts plugin 在无 tsconfig 时报 "Couldn't process compiler options"
            ...(existsSync(path.resolve(this.context, "tsconfig.json"))
                ? [typescript({
                    tsconfig:    path.resolve(this.context, "tsconfig.json"),
                    outDir:      resolvedOutDir,
                    declaration: isLibrary,
                    noEmit:      false,
                    // 与 rollup output.sourcemap 保持一致，避免 "Rollup 'sourcemap' option must be set" 警告
                    sourceMap:   rawEnvConfig.js?.sourcemap ?? false,
                })]
                : []),
            babel({
                babelHelpers: "bundled",
                extensions,
                // 排除 node_modules：第三方包已是浏览器兼容产物，不需要 babel 再次转译；
                // 同时避免处理超大文件（如 react-dom.development.js）触发 babel 性能降级警告
                exclude: ["node_modules/**"],
                presets: [
                    ["@babel/preset-env", { modules: false }],
                    // React 框架（含 .jsx）：preset-react 处理 JSX 转 React.createElement
                    ...(rawEnvConfig.framework === "react"
                        ? [["@babel/preset-react", { runtime: "automatic" }]]
                        : []),
                    "@babel/preset-typescript",
                ],
            }),
        ];

        const external = isServerPass
            ? this.resolveServerExternals(rawEnvConfig)
            : (rawEnvConfig.externals || []);

        // ── Build output config ───────────────────────────────────────────────
        let output: OutputOptions | OutputOptions[];

        if (isServerPass) {
            // SSR server pass：单产物 cjs/esm
            const ssrCfg = rawEnvConfig.ssr;
            const fmt = ssrCfg?.output?.formats === "esm" ? "es" : "cjs";
            output = {
                file: path.resolve(resolvedOutDir, ssrCfg?.output?.filename || "server.cjs"),
                format: fmt,
                sourcemap: rawEnvConfig.js?.sourcemap || false,
                exports: "named",
                inlineDynamicImports: true,
            };
        } else if (isLibrary && fmtArr.length > 1) {
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
            if (isLibrary) {
                output = {
                    file:                 path.resolve(resolvedOutDir, `${baseName}${FORMAT_SUFFIX[primaryFmt] ?? ".js"}`),
                    format:               rollupFmt,
                    sourcemap:            rawEnvConfig.js?.sourcemap || false,
                    name:                 ["umd", "iife"].includes(rollupFmt as string)
                        ? (libraryName || path.basename(String(entry), path.extname(String(entry))))
                        : undefined,
                    inlineDynamicImports: ["umd", "iife"].includes(rollupFmt as string),
                };
            } else {
                // 应用模式强制使用 ES 格式：UMD/IIFE 不支持 code-splitting（dynamic import）
                const appFmt: OutputOptions["format"] = ["es", "cjs"].includes(rollupFmt as string)
                    ? rollupFmt
                    : "es";
                if (appFmt !== rollupFmt) {
                    this.logger.warn(`应用模式不支持 "${primaryFmt}" 格式（不支持 code-splitting），已自动切换为 "es"`, "rollup");
                }
                output = {
                    dir:                  resolvedOutDir,
                    entryFileNames:       singleFilename,
                    format:               appFmt,
                    sourcemap:            rawEnvConfig.js?.sourcemap || false,
                };
            }
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

        // 应用模式：存储 HTML 写入配置（server pass 不需要）
        if (!isLibrary && !isServerPass) {
            const pages = rawEnvConfig.pages as Array<{
                template?: string;
                filename?: string;
                inject?: "head" | "body";
            }> | undefined;
            const page = pages?.[0];

            // 确定实际使用的输出格式（应用模式可能从 umd/iife 切换到 es）
            const resolvedFormat = Array.isArray(output)
                ? (output[0]?.format ?? "es")
                : ((output as OutputOptions)?.format ?? "es");

            this.htmlWriteConfig = {
                outDir:         resolvedOutDir,
                template:       page?.template,
                filename:       page?.filename || "index.html",
                inject:         page?.inject   || "body",
                context:        this.context,
                entryFilename:  singleFilename,
                format:         resolvedFormat,
            };
        }

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

    /**
     * SSR server pass externals — 委托给 shared-utils 统一实现
     */
    private resolveServerExternals(rawEnvConfig: any): any[] | ((id: string) => boolean) {
        return resolveSSRExternals(rawEnvConfig.ssr, this.context) as any[] | ((id: string) => boolean);
    }

    public async run(config: RollupOptions) {
        try {
            this.logger.info("开始使用rollup进行打包");
            const isServerPass = (config as any).__isServerPass;  // (legacy hint, not used)
            switch (this.mode) {
                case "development":
                    // dev 模式：如果是 server pass（已较少出现），跑一次 prodBuild
                    if (this.devServerConfig && this.devServerConfig.library === false &&
                        // 通过 output.format 判断 server pass：
                        Array.isArray(config.output) ? false :
                        (config.output as OutputOptions)?.format === "cjs" &&
                        ((config.output as OutputOptions)?.file as string)?.endsWith(".cjs")) {
                        await this.prodBuild(config);
                        break;
                    }
                    await this.devBuild(config);
                    break;
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
            let buildHasError = false;
            watcher.on("event", async (event: any) => {
                if (event.code === "START") {
                    buildHasError = false;
                    this.logger.log("rollup 开始重新构建...", "rollup");
                }
                if (event.code === "ERROR") {
                    buildHasError = true;
                    this.logger.error(`rollup 构建错误: ${event.error}`, "rollup");
                    if (!serverStarted) resolve();
                }
                if (event.code === "END") {
                    this.logger.done("rollup 构建完成", "rollup");
                    // 构建有错误时跳过 HTML 写入和服务启动，避免空白页面
                    if (buildHasError) {
                        if (event.result) event.result.close();
                        return;
                    }
                    // 每次构建完成后写 HTML（保证 index.html 与 JS 同步）
                    if (this.htmlWriteConfig) {
                        try {
                            writeHtmlFile(this.htmlWriteConfig);
                        } catch (e: any) {
                            this.logger.warn(`[bundlekit] 写入 HTML 失败: ${e.message}`);
                        }
                    }
                    if (!serverStarted) {
                        serverStarted = true;
                        await server.start();
                        resolve();
                    } else {
                        server.reload();   // 后续构建：触发浏览器 livereload
                    }
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
        // 生产构建也写 HTML（应用模式）
        if (this.htmlWriteConfig) {
            writeHtmlFile(this.htmlWriteConfig);
        }
        this.logger.done("rollup 生产构建完成", "rollup");
        await bundle.close();
    }

    /**
     * Rollup dev SSR middleware
     *
     * 实现：
     *   1. **Client pass**：rollup.watch 编译 client 写到 envConfig.output.dir，
     *      构建完成调 writeHtmlFile 生成 dist/index.html（带 <script> 注入）。
     *   2. **Server pass**：buildSSRView 切换到 server，单独 rollup.watch 写到
     *      ssr.output.dir。
     *   3. **Middleware 链**：createStaticFileMiddleware + ssrHandler。
     *      ssrHandler 优先用 dist/index.html 作模板，避免漏掉 <script>。
     */
    public async createSSRMiddleware(
        buildConfig: IBuildConfig,
        ctx: ISSRMiddlewareCtx,
    ): Promise<IRequestHandler[]> {
        const envConfig = buildConfig.config?.[this.mode] || buildConfig.config?.development;
        const ssrConfig = (envConfig as any)?.ssr;
        if (!ssrConfig) throw new Error("ssr config not found in envConfig");

        // ── 1) Client pass ─────────────────────────────────────────────────────
        const clientConfig = sanitizeRollupOptions(await this.transformConfig(buildConfig));
        const clientHtmlConfig = this.htmlWriteConfig;
        const clientOutDir = path.resolve(
            this.context,
            (Array.isArray((envConfig as any).output)
                ? (envConfig as any).output[0]?.dir
                : (envConfig as any).output?.dir) || "dist",
        );
        const publicPath = (envConfig as any)?.publicPath || "/";

        let clientReady = false;
        let clientPending: Array<() => void> = [];
        const waitClient = () =>
            clientReady ? Promise.resolve() : new Promise<void>((r) => clientPending.push(r));

        const clientWatcher = watch({
            ...clientConfig,
            watch: { clearScreen: false, exclude: "node_modules/**" },
        } as any);
        clientWatcher.on("event", (event: any) => {
            if (event.code === "END") {
                if (clientHtmlConfig) {
                    try {
                        writeHtmlFile(clientHtmlConfig);
                    } catch (e: any) {
                        this.logger.warn(`[bundlekit] SSR client HTML 写入失败: ${e.message}`, "rollup");
                    }
                }
                clientReady = true;
                const r = clientPending; clientPending = []; r.forEach((f) => f());
            }
            if (event.code === "ERROR") {
                this.logger.error(`rollup client compiler 错误: ${event.error}`, "rollup");
            }
            if (event.result) event.result.close();
        });

        // ── 2) Server pass ─────────────────────────────────────────────────────
        const serverBuildConfig = buildSSRView(buildConfig, this.mode);
        const serverConfig = sanitizeRollupOptions(await this.transformConfig(serverBuildConfig));

        const serverOutDir = path.resolve(this.context, ssrConfig.output.dir);
        const serverFilename = ssrConfig.output.filename || "server.cjs";
        const serverBundlePath = path.resolve(serverOutDir, serverFilename);

        let serverReady = false;
        let serverPending: Array<() => void> = [];
        const waitServer = () =>
            serverReady ? Promise.resolve() : new Promise<void>((r) => serverPending.push(r));

        const serverWatcher = watch({
            ...serverConfig,
            watch: { clearScreen: false, exclude: "node_modules/**" },
        } as any);
        serverWatcher.on("event", (event: any) => {
            if (event.code === "END") {
                serverReady = true;
                const r = serverPending; serverPending = []; r.forEach((f) => f());
            }
            if (event.code === "ERROR") {
                this.logger.error(`rollup server compiler 错误: ${event.error}`, "rollup");
            }
            if (event.result) event.result.close();
        });

        // ── 3) Middleware 链 ────────────────────────────────────────────────────
        const staticMW = createStaticFileMiddleware({
            outDir: clientOutDir,
            publicPath,
            skipIndexHtml: true,
        });

        const ssrHandler = createSSRRequestHandler({
            context: this.context,
            ssrConfig,
            serverBundlePath: () => serverBundlePath,
            waitUntilReady: async () => {
                await waitClient();
                await waitServer();
            },
            getTemplate: async () => {
                const compiled = path.join(clientOutDir, "index.html");
                if (existsSync(compiled)) {
                    return readFileSync(compiled, "utf-8");
                }
                const templatePath = ssrConfig.template
                    ? path.resolve(this.context, ssrConfig.template)
                    : path.resolve(this.context, "public/index.html");
                return readFileSync(templatePath, "utf-8");
            },
            onError: (e) => this.logger.error(`SSR 渲染失败: ${e?.message ?? e}`, "rollup"),
        });

        return [staticMW, ssrHandler];
    }
}
