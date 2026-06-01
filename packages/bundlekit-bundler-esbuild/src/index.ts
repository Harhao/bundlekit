import path from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import * as esbuild from "esbuild";

import {
    Logger,
    validateBuildConfig,
    createSSRRequestHandler,
    buildSSRView,
    resolveSSRExternals,
    createStaticFileMiddleware,
} from "@bundlekit/shared-utils";
import type {
    IBuildConfig,
    IBuildToolAdapter,
    IService,
    IBuildEnv,
    IRequestHandler,
    ISSRMiddlewareCtx,
} from "@bundlekit/shared-utils";
import { DevServer } from "./DevServer";

/**
 * 从字符串 entry 派生 chunk 名（去目录、去扩展名）。和 webpack/rspack/vite/rolldown
 * 适配器保持一致，避免 [name].js 永远输出 app.js 与模板 main 字段错位。
 */
function deriveChunkName(entry: string): string {
    const base = path.basename(entry, path.extname(entry));
    return base || "app";
}

// Node.js 18+ 内置模块名单（含 node: 前缀变体），用于 SSR auto externals
const NODE_BUILTINS: string[] = [
    "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
    "constants", "crypto", "dgram", "diagnostics_channel", "dns", "domain",
    "events", "fs", "http", "http2", "https", "inspector", "module", "net",
    "os", "path", "perf_hooks", "process", "punycode", "querystring",
    "readline", "repl", "stream", "string_decoder", "sys", "timers", "tls",
    "trace_events", "tty", "url", "util", "v8", "vm", "wasi", "worker_threads",
    "zlib",
].flatMap((m) => [m, `node:${m}`]);
type EsbuildFormat = "esm" | "cjs" | "iife";

const toEsbuildFormat = (fmt: string): EsbuildFormat => {
    const map: Record<string, EsbuildFormat> = {
        es:        "esm",
        esm:       "esm",
        module:    "esm",
        cjs:       "cjs",
        commonjs:  "cjs",
        umd:       "iife",   // esbuild 无 UMD，用 iife 兜底
        iife:      "iife",
    };
    return map[fmt] ?? "esm";
};

/**
 * esbuild 的 external 只接受 string[]，不接受函数。
 * resolveSSRExternals 在 "auto" 模式下可能返回函数，需要转换：
 *   - 数组：直接使用
 *   - 函数：从 project package.json 读取 dep 名列表 + node 内置模块
 */
function resolveEsbuildExternals(ssrConfig: any, context: string): string[] {
    const raw = resolveSSRExternals(ssrConfig, context);
    if (Array.isArray(raw)) return raw.filter((e) => typeof e === "string");

    // 函数模式（"auto"）：收集项目 deps + node builtins
    const nodeBuiltins = NODE_BUILTINS;
    const depNames: string[] = [];
    try {
        const pkgPath = path.join(context, "package.json");
        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, any>;
            depNames.push(...Object.keys(pkg.dependencies  || {}));
            depNames.push(...Object.keys(pkg.peerDependencies || {}));
        }
    } catch { /* ignore */ }
    return [...new Set([...nodeBuiltins, ...depNames])];
}
function stripWebpackTokens(tpl: string): string {
    return tpl
        .replace(/\[(?:contenthash|chunkhash|hash)(?::\d+)?\]/g, "")
        .replace(/\.{2,}/g, ".")
        .replace(/^[.\-]+|[.\-]+$/g, "");
}

// ─── DevServer 缓存配置 ─────────────────────────────────────────────────────────
interface StoredDevServerConfig {
    host:    string;
    port:    number;
    open:    boolean;
    proxy:   Record<string, any>;
    outDir:  string;
    library: boolean;
}

// ─── HTML 写入配置 ──────────────────────────────────────────────────────────────
interface HtmlWriteConfig {
    outDir:   string;
    template?: string;
    filename: string;
    inject:   "head" | "body";
    context:  string;
}

/** 扫描 outDir 中的 JS/CSS 文件并注入到 HTML 模板 */
function writeHtmlFile(opts: HtmlWriteConfig): void {
    let jsFiles:  string[] = [];
    let cssFiles: string[] = [];
    try {
        const files = readdirSync(opts.outDir);
        jsFiles  = files.filter((f) => /\.(js|mjs|cjs)$/.test(f) && !f.endsWith(".map"));
        cssFiles = files.filter((f) => f.endsWith(".css")         && !f.endsWith(".map"));
    } catch { /* outDir 可能还不存在 */ }

    const linkTags   = cssFiles.map((c) => `  <link rel="stylesheet" href="${c}">`).join("\n");
    const scriptTags = jsFiles .map((s) => `  <script src="${s}"></script>`).join("\n");

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

export default class EsbuildBundler implements IBuildToolAdapter {

    private context: string;
    private mode:    IBuildEnv;
    private logger:  Logger = new Logger();
    private devServerConfig: StoredDevServerConfig | null = null;
    private htmlWriteConfig: HtmlWriteConfig | null = null;
    public  name: string = "@bundlekit/bundler-esbuild";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode    = mode;
        this.context = api.context || process.cwd();
    }

    public async transformConfig(config: IBuildConfig): Promise<esbuild.BuildOptions> {
        const rawEnvConfig = (
            config.config?.[this.mode] || config.config?.development || {}
        ) as Record<string, any>;
        const framework = rawEnvConfig.framework as string | undefined;

        const isServerPass = rawEnvConfig.__isServerPass === true;

        // ── Entry ─────────────────────────────────────────────────────────────
        const entryRaw = rawEnvConfig.entry;
        let entryPoints: Record<string, string>;
        if (!entryRaw) {
            entryPoints = { app: path.resolve(this.context, "src/index.tsx") };
        } else if (typeof entryRaw === "string") {
            // chunk 名按 entry basename 派生（与 webpack/rspack 适配器一致）
            entryPoints = { [deriveChunkName(entryRaw)]: path.resolve(this.context, entryRaw) };
        } else {
            entryPoints = Object.fromEntries(
                Object.entries(entryRaw as Record<string, string>).map(([k, v]) => [
                    k, path.resolve(this.context, v),
                ]),
            );
        }

        // ── Output dir ────────────────────────────────────────────────────────
        const outDirRel =
            (!Array.isArray(rawEnvConfig.output) && rawEnvConfig.output?.dir) ||
            (Array.isArray(rawEnvConfig.output)  && rawEnvConfig.output[0]?.dir) ||
            "dist";
        const outDir = path.resolve(this.context, outDirRel);

        // ── Format ────────────────────────────────────────────────────────────
        const fmtRaw = rawEnvConfig.output?.formats;
        const requestedFormat = (Array.isArray(fmtRaw) ? fmtRaw[0] : (fmtRaw || "esm")) as string;
        const fmt    = toEsbuildFormat(requestedFormat);

        // ── entryNames（文件名模板）──────────────────────────────────────────
        const rawFilename = rawEnvConfig.output?.filename || "[name].js";
        const stripped    = stripWebpackTokens(rawFilename);
        // esbuild entryNames 只支持 [name] [hash] [dir] - 去掉 .js 后缀让 esbuild 自己加
        const entryNameBase = stripped.replace(/\.(js|mjs|cjs)$/, "") || "[name]";
        const entryNames    = entryNameBase.includes("[name]") ? entryNameBase : `${entryNameBase}-[name]`;

        // ── JS / CSS options ──────────────────────────────────────────────────
        const jsConfig  = rawEnvConfig.js  || {};
        const cssConfig = rawEnvConfig.css || {};
        const isLibrary = rawEnvConfig.library === true;
        const minify    = jsConfig.minify   ?? (this.mode === "production");
        const sourcemap = (jsConfig.sourcemap ?? false) ? "inline" as const : false as const;

        // ── Library 模式：library / libraryName 接入 ──────────────────────────
        // esbuild 原生不支持 UMD：把 umd 映射成 iife + globalName + 包一层 UMD
        // wrapper（banner/footer）。这样产物在 cjs / amd / browser 三种宿主里都能跑。
        const libraryName = rawEnvConfig.libraryName as string | undefined;
        const isUmdRequested = isLibrary && requestedFormat === "umd";
        const isIifeRequested = isLibrary && (requestedFormat === "iife" || isUmdRequested);
        const globalName = isIifeRequested && libraryName ? libraryName : undefined;
        const umdBanner = isUmdRequested && libraryName
            ? `(function(global,factory){"use strict";typeof exports==="object"&&typeof module!=="undefined"?module.exports=factory():typeof define==="function"&&define.amd?define([],factory):(global=typeof globalThis!=="undefined"?globalThis:global||self,global["${libraryName}"]=factory());}(this,function(){`
            : undefined;
        const umdFooter = isUmdRequested && libraryName
            ? `return typeof ${libraryName}!=="undefined"?${libraryName}:undefined;}));`
            : undefined;

        // ── Alias → esbuild alias ────────────────────────────────────────────
        const alias: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawEnvConfig.alias || {})) {
            alias[k] = path.resolve(this.context, String(v));
        }

        // ── Externals ─────────────────────────────────────────────────────────
        const external: string[] = isServerPass
            ? resolveEsbuildExternals(rawEnvConfig.ssr, this.context)
            : (rawEnvConfig.externals || []);

        // ── define ────────────────────────────────────────────────────────────
        const isProd = this.mode === "production";
        const define: Record<string, string> = {
            "process.env.NODE_ENV":    JSON.stringify(isProd ? "production" : "development"),
            "import.meta.env.MODE":    JSON.stringify(isProd ? "production" : "development"),
            "import.meta.env.PROD":    String(isProd),
            "import.meta.env.DEV":     String(!isProd),
            "import.meta.env.SSR":     "false",
        };

        // ── DevServer config ──────────────────────────────────────────────────
        this.devServerConfig = {
            host:    rawEnvConfig.devServer?.host  ?? "0.0.0.0",
            port:    rawEnvConfig.devServer?.port  ?? 3000,
            open:    rawEnvConfig.devServer?.open  ?? false,
            proxy:   rawEnvConfig.devServer?.proxy ?? {},
            outDir,
            library: isLibrary,
        };

        // ── HTML 写入配置（应用模式用；library / server pass / target=node 都不写）
        const isNodeTarget = rawEnvConfig.target === "node";
        if (!isLibrary && !isServerPass && !isNodeTarget) {
            const pages  = rawEnvConfig.pages as Array<{ template?: string; filename?: string; inject?: "head" | "body" }> | undefined;
            const page   = pages?.[0];
            this.htmlWriteConfig = {
                outDir,
                template: page?.template,
                filename: page?.filename || "index.html",
                inject:   page?.inject   || "body",
                context:  this.context,
            };
        }

        this.logger.info("开始转换 esbuild 配置");

        // 框架插件：Vue 3 / Svelte SFC 支持。esbuild 没有官方 vue/svelte 插件，
        // 使用社区 esbuild-plugin-vue3 / esbuild-svelte。
        // 提前到 SSR pass 分支前面 — server pass 也需要 .vue / .svelte 编译能力。
        const frameworkPlugins: esbuild.Plugin[] = [];
        if (framework === "vue3") {
            try {
                const vue3Module = await import("esbuild-plugin-vue3");
                const vuePluginFactory = (vue3Module as any).default || vue3Module;
                frameworkPlugins.push(vuePluginFactory());
            } catch {
                this.logger.warn("framework 为 vue3 但未安装 esbuild-plugin-vue3，跳过");
            }
        } else if (framework === "svelte") {
            try {
                const svelteModule = await import("esbuild-svelte");
                const sveltePluginFactory = (svelteModule as any).default || svelteModule;
                let preprocess: any = undefined;
                try {
                    const preprocessMod = await import("svelte-preprocess");
                    const factory = (preprocessMod as any).default || (preprocessMod as any);
                    preprocess = typeof factory === "function" ? factory() : factory;
                } catch {
                    this.logger.warn("framework 为 svelte 但未安装 svelte-preprocess，将无法处理 <script lang=\"ts\">");
                }
                frameworkPlugins.push(
                    sveltePluginFactory({
                        ...(preprocess ? { preprocess } : {}),
                        compilerOptions: {
                            generate: isServerPass ? "ssr" : "dom",
                            hydratable: !!rawEnvConfig.ssr,
                        },
                    }),
                );
            } catch {
                this.logger.warn("framework 为 svelte 但未安装 esbuild-svelte，跳过");
            }
        } else if (framework === "angular") {
            // esbuild 原生支持 TypeScript decorators 与 emitDecoratorMetadata（通过 tsconfig）；
            // 但不做 AOT 模板编译。第一版仅保证 JIT 可跑，logger.warn 标注实验性。
            // 未来若要加 AOT，可对接社区 esbuild-angular plugin（目前维护停滞）。
            this.logger.warn(
                "experimental: angular on esbuild uses JIT mode (no AOT template compilation). " +
                "Bundle size will be larger; for production prefer vite / webpack / rspack / rollup / rolldown.",
            );
        }

        // ── SSR server pass ───────────────────────────────────────────────────
        if (isServerPass) {
            const ssrCfg    = rawEnvConfig.ssr;
            const ssrOutDir = ssrCfg?.output?.dir
                ? path.resolve(this.context, ssrCfg.output.dir)
                : path.resolve(this.context, "dist/server");
            return {
                entryPoints,
                outdir:     ssrOutDir,
                bundle:     true,
                format:     "cjs",
                platform:   "node",
                target:     ["node18"],
                entryNames: "[name]",
                minify:     false,
                sourcemap:  false,
                define,
                alias,
                external,
                plugins:    frameworkPlugins,
            };
        }

        return {
            entryPoints,
            outdir:     outDir,
            bundle:     true,
            format:     fmt,
            platform:   rawEnvConfig.target === "node" ? "node" : "browser",
            target:     ["es2020"],
            entryNames,
            minify,
            sourcemap,
            define,
            alias,
            external,
            plugins:    frameworkPlugins,
            ...(globalName ? { globalName } : {}),
            ...(umdBanner ? { banner: { js: umdBanner } } : {}),
            ...(umdFooter ? { footer: { js: umdFooter } } : {}),
            // esbuild 原生支持 JSX/TSX
            jsx:              "automatic",
            jsxImportSource:  "react",
            // CSS modules 简单支持（extract 无需配置，esbuild 自动输出同名 .css）
            loader: {
                ".tsx":  "tsx",
                ".ts":   "ts",
                ".jsx":  "jsx",
                ".js":   "js",
                ".css":  cssConfig.modules ? "local-css" : "css",
                ".svg":  "dataurl",
                ".png":  "dataurl",
                ".jpg":  "dataurl",
                ".jpeg": "dataurl",
                ".gif":  "dataurl",
                ".woff": "dataurl",
                ".woff2":"dataurl",
                ".ttf":  "dataurl",
            },
            splitting: fmt === "esm" && !isLibrary && jsConfig.splitChunks !== false,
            ...(fmt === "esm" && !isLibrary && jsConfig.splitChunks !== false
                ? { chunkNames: "chunks/[name]-[hash]" }
                : {}),
        };
    }

    public validateConfig(config: any): boolean {
        const result = validateBuildConfig(config as any, this.mode);
        if (!result.valid) {
            this.logger.error(`配置校验失败:\n${result.errors.join("\n")}`);
            return false;
        }
        return true;
    }

    public async run(config: esbuild.BuildOptions): Promise<void> {
        try {
            this.logger.info("开始使用 esbuild 进行打包");
            switch (this.mode) {
                case "development": await this.devBuild(config);  break;
                case "production":
                case "test":
                case "staging":
                case "gray":        await this.prodBuild(config); break;
                default: break;
            }
        } catch (e) {
            this.logger.error(`esbuild 打包失败: ${e}`);
            throw e;
        }
    }

    // ─── Development build：watch + optional DevServer ────────────────────────
    private async devBuild(config: esbuild.BuildOptions): Promise<void> {
        const devCfg    = this.devServerConfig;
        const isLibrary = devCfg?.library ?? false;

        let serverStarted = false;
        let server: InstanceType<typeof DevServer> | null = null;

        if (!isLibrary) {
            server = new DevServer(
                {
                    host:   devCfg?.host   ?? "0.0.0.0",
                    port:   devCfg?.port   ?? 3000,
                    outDir: devCfg?.outDir ?? path.resolve(this.context, "dist"),
                    open:   devCfg?.open   ?? false,
                    proxy:  devCfg?.proxy  ?? {},
                },
                this.logger,
            );
        }

        const resolveFirst = { resolve: (_: void) => {}, promise: Promise.resolve() };
        let resolveReady: () => void;
        const readyPromise = new Promise<void>((r) => (resolveReady = r));

        const ctx = await esbuild.context({
            ...config,
            plugins: [
                ...(config.plugins ?? []),
                {
                    name: "bundlekit-watch",
                    setup(build) {
                        build.onEnd(async (result) => {
                            if (result.errors.length > 0) {
                                return;
                            }
                            if (isLibrary) {
                                return;
                            }
                            // 每次构建后写 HTML
                            // (this 不在闭包里，通过外部变量访问)
                        });
                    },
                },
            ],
        });

        // 用独立 onEnd plugin 闭包访问外部变量
        const ctxWithHook = await esbuild.context({
            ...config,
            plugins: [
                ...(config.plugins ?? []),
                {
                    name: "bundlekit-devserver",
                    setup: (build) => {
                        build.onEnd(async (result) => {
                            if (result.errors.length > 0) {
                                this.logger.error(`esbuild 构建错误: ${result.errors[0]?.text}`, "esbuild");
                                if (!serverStarted) resolveReady!();
                                return;
                            }
                            this.logger.done("esbuild 构建完成", "esbuild");

                            if (isLibrary) {
                                if (!serverStarted) { serverStarted = true; resolveReady!(); }
                                return;
                            }

                            // 写 HTML
                            if (this.htmlWriteConfig) {
                                try { writeHtmlFile(this.htmlWriteConfig); } catch { /* ignore */ }
                            }

                            if (!serverStarted) {
                                serverStarted = true;
                                await server!.start();
                                resolveReady!();
                            } else {
                                server!.reload();
                            }
                        });
                    },
                },
            ],
        });

        // 废弃第一个 ctx（被 ctxWithHook 替代）
        await ctx.dispose();

        await ctxWithHook.watch();

        if (isLibrary) {
            this.logger.info("esbuild library watch 模式已启动", "esbuild");
        }

        // 等待首次构建完成
        await readyPromise;

        // 应用模式保持进程存活（watch 持续运行）
        if (!isLibrary) {
            await new Promise<void>(() => {
                process.on("SIGINT",  async () => { await ctxWithHook.dispose(); process.exit(0); });
                process.on("SIGTERM", async () => { await ctxWithHook.dispose(); process.exit(0); });
            });
        }
    }

    // ─── Production build ──────────────────────────────────────────────────────
    private async prodBuild(config: esbuild.BuildOptions): Promise<void> {
        const result = await esbuild.build(config);

        // 写 HTML（应用模式）
        if (this.htmlWriteConfig) {
            writeHtmlFile(this.htmlWriteConfig);
        }

        const outputs = result.metafile
            ? Object.keys(result.metafile.outputs).map((f) => `  ${f}`).join("\n")
            : "";
        this.logger.done(`esbuild 生产构建完成\n${outputs}`, "esbuild");
    }

    /**
     * esbuild dev SSR middleware
     *
     * 实现：
     *   1. **Client pass**：esbuild.context().watch()，构建完成调 writeHtmlFile
     *      把 client 产物作 <script> 注入到 dist/index.html。
     *   2. **Server pass**：buildSSRView 切到 server，单独 esbuild.context().watch()
     *      输出到 ssr.output.dir，文件名固定为 server.cjs。
     *   3. **Middleware 链**：createStaticFileMiddleware + ssrHandler；
     *      ssrHandler 优先用 dist/index.html 作模板。
     */
    public async createSSRMiddleware(
        buildConfig: IBuildConfig,
        _ctx: ISSRMiddlewareCtx,
    ): Promise<IRequestHandler[]> {
        const envConfig = buildConfig.config?.[this.mode] || buildConfig.config?.development;
        const ssrConfig = (envConfig as any)?.ssr;
        if (!ssrConfig) throw new Error("ssr config not found in envConfig");

        // ── 1) Client pass ─────────────────────────────────────────────────────
        const clientEsbuildOpts = await this.transformConfig(buildConfig) as esbuild.BuildOptions;
        const clientHtmlConfig = this.htmlWriteConfig;
        const clientOutDir = path.resolve(
            this.context,
            (Array.isArray((envConfig as any).output)
                ? (envConfig as any).output[0]?.dir
                : (envConfig as any).output?.dir) || "dist",
        );
        const publicPath = (envConfig as any)?.publicPath || "/";

        mkdirSync(clientOutDir, { recursive: true });

        let clientReady = false;
        let clientPending: Array<() => void> = [];
        const waitClient = () =>
            clientReady ? Promise.resolve() : new Promise<void>((r) => clientPending.push(r));

        const clientCtx = await esbuild.context({
            ...clientEsbuildOpts,
            plugins: [
                ...(clientEsbuildOpts.plugins ?? []),
                {
                    name: "bundlekit-ssr-client-ready",
                    setup: (build) => {
                        build.onEnd((result) => {
                            if (result.errors.length > 0) {
                                this.logger.error(
                                    `esbuild client compiler 错误: ${result.errors[0]?.text}`,
                                    "esbuild",
                                );
                                return;
                            }
                            if (clientHtmlConfig) {
                                try { writeHtmlFile(clientHtmlConfig); } catch (e: any) {
                                    this.logger.warn(
                                        `[bundlekit] SSR client HTML 写入失败: ${e.message}`,
                                        "esbuild",
                                    );
                                }
                            }
                            clientReady = true;
                            const r = clientPending; clientPending = []; r.forEach((f) => f());
                        });
                    },
                },
            ],
        });
        await clientCtx.watch();

        // ── 2) Server pass ─────────────────────────────────────────────────────
        const serverBuildConfig = buildSSRView(buildConfig, this.mode);
        const serverEsbuildOpts = await this.transformConfig(serverBuildConfig) as esbuild.BuildOptions;

        const serverOutDir = path.resolve(this.context, ssrConfig.output.dir);
        const serverFilename = ssrConfig.output.filename || "server.cjs";

        // esbuild 输出文件名由 entryNames 决定，通常是 entry-server.js
        // 我们把 entryNames 固定为 "server"，这样产物是 server.js
        const serverEntryNames = "server";
        let resolvedBundlePath = path.resolve(serverOutDir, `${serverEntryNames}.js`);

        let serverReady = false;
        let serverPending: Array<() => void> = [];
        const waitServer = () =>
            serverReady ? Promise.resolve() : new Promise<void>((r) => serverPending.push(r));

        mkdirSync(serverOutDir, { recursive: true });

        const serverCtx = await esbuild.context({
            ...serverEsbuildOpts,
            outdir:     serverOutDir,
            entryNames: serverEntryNames,
            format:     "cjs",
            platform:   "node",
            // esbuild 生成 .js，所以 serverFilename 中的 .cjs 需要适配
            outExtension: { ".js": ".cjs" },
            plugins: [
                // 先把 transformConfig 配进来的框架插件（如 esbuild-plugin-vue3）保留，
                // 否则 server pass 编不动 .vue 文件，serverReady 永远拿不到 → dev SSR
                // 启动 timeout
                ...(serverEsbuildOpts.plugins ?? []),
                {
                    name: "bundlekit-ssr-ready",
                    setup: (build) => {
                        build.onEnd((result) => {
                            if (result.errors.length > 0) {
                                this.logger.error(
                                    `esbuild server compiler 错误: ${result.errors[0]?.text}`,
                                    "esbuild",
                                );
                                return;
                            }
                            // 产物是 server.cjs（outExtension: .js → .cjs）
                            resolvedBundlePath = path.resolve(serverOutDir, `${serverEntryNames}.cjs`);
                            serverReady = true;
                            const r = serverPending; serverPending = []; r.forEach((f) => f());
                        });
                    },
                },
            ],
        });

        await serverCtx.watch();

        // ── 3) Middleware 链 ────────────────────────────────────────────────────
        const staticMW = createStaticFileMiddleware({
            outDir: clientOutDir,
            publicPath,
            skipIndexHtml: true,
        });

        const ssrHandler = createSSRRequestHandler({
            context:          this.context,
            ssrConfig,
            serverBundlePath: () => resolvedBundlePath,
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
            onError: (e) =>
                this.logger.error(`SSR 渲染失败: ${e?.message ?? e}`, "esbuild"),
        });

        return [staticMW, ssrHandler];
    }
}
