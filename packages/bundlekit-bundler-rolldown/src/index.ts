import path from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { build, watch } from "rolldown";
import postcss from "rollup-plugin-postcss";

import { Logger, validateBuildConfig, createSSRRequestHandler, buildSSRView, resolveSSRExternals, createStaticFileMiddleware } from "@bundlekit/shared-utils";
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

// rolldown format 标准化
const toRolldownFormat = (fmt: string): string => {
    const map: Record<string, string> = {
        commonjs: "cjs",
        esm:      "es",
        es:       "es",
        cjs:      "cjs",
        umd:      "umd",
        iife:     "iife",
    };
    return map[fmt] ?? "es";
};

/**
 * 把 webpack 模板变量转换为 rolldown 支持的等价写法
 *
 * rolldown 原生支持：[name]  [hash]  [hash:N]
 * webpack 专有（rolldown 不识别，会以字面量形式出现在文件名里）：
 *   [contenthash:N]  [chunkhash:N]  [id]
 *
 * 转换规则：
 *   [contenthash:8] → [hash:8]
 *   [chunkhash:8]   → [hash:8]
 *   [contenthash]   → [hash]
 *   [id]            → 移除（含相邻分隔符）
 *
 * 示例：
 *   "[name].js"                  → "[name].js"         ✓ 不变
 *   "[name].[contenthash:8].js"  → "[name].[hash:8].js"  rolldown 可识别
 */
function normalizeEntryFileNames(tpl: string): string {
    return (
        tpl
            // [contenthash:N] / [chunkhash:N] → [hash:N]
            .replace(/\[(?:contenthash|chunkhash):(\d+)\]/g, "[hash:$1]")
            // [contenthash] / [chunkhash] → [hash]
            .replace(/\[(?:contenthash|chunkhash)\]/g, "[hash]")
            // [id]（含可选的前置或后置 . / -）→ 移除
            .replace(/[.\-]?\[id\]/g, "")
            // 清理多余连续点号（如 [name]..js → [name].js）
            .replace(/\.{2,}/g, ".")
        || "[name].js"
    );
}

/**
 * 从字符串 entry 派生 chunk 名（去目录、去扩展名）。和 webpack/rspack 适配器保持
 * 一致，避免 [name].js 永远输出 app.js 与模板 main 字段错位。
 */
function deriveChunkName(entry: string): string {
    const base = path.basename(entry, path.extname(entry));
    return base || "app";
}

// ─── 运行时保留的 devServer 配置 ────────────────────────────────────────────────
interface StoredDevServerConfig {
    host: string;
    port: number;
    open: boolean;
    proxy: Record<string, any>;
    outDir: string;
    library: boolean;
}

// ─── HTML 写入配置 ───────────────────────────────────────────────────────────────
interface HtmlWriteConfig {
    outDir: string;
    template?: string;
    filename: string;
    inject: "head" | "body";
    context: string;
}

/** 根据配置生成并写入 index.html（rolldown 不支持 generateBundle 钩子，手动写文件） */
function writeHtmlFile(opts: HtmlWriteConfig): void {
    // 扫描 outDir 找实际产物文件：
    //  - JS：rolldown 支持 [name] 模板变量但不支持 [contenthash]，文件名以字面量形式落盘
    //  - CSS：postcss extract:true 会生成 .css 文件
    // 通过扫描而非预计算模板，彻底避免模板变量解析差异问题
    let jsFiles:  string[] = [];
    let cssFiles: string[] = [];
    try {
        const files = readdirSync(opts.outDir);
        jsFiles  = files.filter((f) => /\.(js|mjs|cjs)$/.test(f) && !f.endsWith(".map"));
        cssFiles = files.filter((f) => f.endsWith(".css")         && !f.endsWith(".map"));
    } catch { /* outDir 不存在时静默跳过 */ }

    const linkTags   = cssFiles.map((c) => `  <link rel="stylesheet" href="${c}">`).join("\n");
    const scriptTags = jsFiles .map((s) => `  <script src="${s}"></script>`).join("\n");

    let html: string;
    const tplPath = opts.template ? path.resolve(opts.context, opts.template) : null;

    if (tplPath && existsSync(tplPath)) {
        html = readFileSync(tplPath, "utf-8");
        // CSS link 注入 <head>（无论 inject 选项）
        if (linkTags) {
            html = html.includes("</head>")
                ? html.replace("</head>", `${linkTags}\n</head>`)
                : linkTags + "\n" + html;
        }
        // JS script 按 inject 选项注入
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
            ...(linkTags ? [linkTags] : []),
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

export default class RolldownBundler implements IBuildToolAdapter {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    /** transformConfig 阶段存储，run 阶段使用 */
    private devServerConfig: StoredDevServerConfig | null = null;
    private htmlWriteConfig: HtmlWriteConfig | null = null;
    public name: string = "@bundlekit/bundler-rolldown";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode    = mode;
        this.context = api.context || process.cwd();
    }
    public async transformConfig(config: IBuildConfig) {
        const rawEnvConfig = (config.config?.[this.mode] || config.config?.development || {}) as Record<string, any>;
        const framework    = rawEnvConfig.framework as string | undefined;

        // SSR server pass 检测
        const isServerPass = rawEnvConfig.__isServerPass === true;

        // ── Entry ──────────────────────────────────────────────────────────────
        const entry = rawEnvConfig.entry
            ? (typeof rawEnvConfig.entry === "string"
                ? { [deriveChunkName(rawEnvConfig.entry)]: rawEnvConfig.entry }
                : rawEnvConfig.entry)
            : { app: path.resolve(this.context, "src/index.tsx") };

        const resolvedInput: Record<string, string> = {};
        for (const [key, val] of Object.entries(entry)) {
            resolvedInput[key] = path.resolve(this.context, String(val));
        }

        // ── Output dir ────────────────────────────────────────────────────────
        const outDir = (rawEnvConfig.output && !Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output.dir : undefined)
            || (Array.isArray(rawEnvConfig.output) ? rawEnvConfig.output[0]?.dir : undefined)
            || "dist";
        const resolvedOutDir = path.resolve(this.context, outDir);

        const alias    = rawEnvConfig.alias  || {};
        const jsConfig = rawEnvConfig.js     || {};
        const cssConfig= rawEnvConfig.css    || {};

        // ── Library mode ──────────────────────────────────────────────────────
        const isLibrary   = rawEnvConfig.library === true;
        const libraryName = rawEnvConfig.libraryName as string | undefined;

        // ── Formats ───────────────────────────────────────────────────────────
        const fmtRaw = rawEnvConfig.output?.formats;
        const fmtArr: string[] = Array.isArray(fmtRaw) ? fmtRaw : [fmtRaw || "es"];

        // ── Base filename ──────────────────────────────────────────────────────
        const rawFilename = rawEnvConfig.output?.filename || "[name].js";
        // 把 webpack 专有模板变量（[contenthash:8] 等）转换为 rolldown 支持的格式
        const normalizedFilename = normalizeEntryFileNames(rawFilename);
        const baseName = normalizedFilename.replace(/\[.+?\]/g, "").replace(/\.[^.]+$/, "") || "index";

        // ── CSS plugin ────────────────────────────────────────────────────────
        const cssPlugin = postcss({
            extract:   cssConfig.extract  || false,
            modules:   cssConfig.modules  || false,
            sourceMap: cssConfig.sourcemap || false,
            use: [
                ...(cssConfig.loaders?.includes("less") ? ["less"] : []),
                ...(cssConfig.loaders?.includes("sass") || cssConfig.loaders?.includes("scss") ? ["sass"] : []),
            ],
        }) as any;

        // ── Build output config ───────────────────────────────────────────────
        let output: any;
        const primaryFmt = fmtArr[0] ?? "es";
        const primaryRdFmt = toRolldownFormat(primaryFmt);

        if (isServerPass) {
            // SSR server pass：单产物 cjs/esm
            const ssrCfg = rawEnvConfig.ssr;
            const fmt = ssrCfg?.output?.formats === "esm" ? "es" : "cjs";
            output = {
                dir: resolvedOutDir,
                format: fmt,
                sourcemap: jsConfig.sourcemap || false,
                entryFileNames: ssrCfg?.output?.filename || "server.cjs",
            };
        } else if (isLibrary && fmtArr.length > 1) {
            output = fmtArr.map((fmt) => {
                const rdFmt  = toRolldownFormat(fmt);
                const suffix = FORMAT_SUFFIX[fmt] ?? ".js";
                return {
                    dir:            resolvedOutDir,
                    format:         rdFmt,
                    sourcemap:      jsConfig.sourcemap || false,
                    entryFileNames: `${baseName}${suffix}`,
                    name:           ["umd", "iife"].includes(rdFmt)
                        ? (libraryName || Object.keys(resolvedInput)[0] || "index")
                        : undefined,
                };
            });
        } else {
            output = {
                dir:            resolvedOutDir,
                format:         primaryRdFmt,
                sourcemap:      jsConfig.sourcemap || false,
                entryFileNames: isLibrary
                    ? `${baseName}${FORMAT_SUFFIX[primaryFmt] ?? ".js"}`
                    : normalizedFilename,
                name:           ["umd", "iife"].includes(primaryRdFmt)
                    ? (libraryName || Object.keys(resolvedInput)[0] || "index")
                    : undefined,
            };
        }

        // ── 存储 devServer 配置 ───────────────────────────────────────────────
        this.devServerConfig = {
            host:    rawEnvConfig.devServer?.host  ?? "0.0.0.0",
            port:    rawEnvConfig.devServer?.port  ?? 3000,
            open:    rawEnvConfig.devServer?.open  ?? false,
            proxy:   rawEnvConfig.devServer?.proxy ?? {},
            outDir:  resolvedOutDir,
            library: isLibrary,
        };

        // ── 存储 HTML 写入配置（应用模式用；server pass / library / target=node 都不写 HTML）
        const isNodeTarget = rawEnvConfig.target === "node";
        if (!isLibrary && !isServerPass && !isNodeTarget) {
            const pages = rawEnvConfig.pages as Array<{
                template?: string;
                filename?: string;
                inject?: "head" | "body";
            }> | undefined;
            const page = pages?.[0];

            this.htmlWriteConfig = {
                outDir:   resolvedOutDir,
                template: page?.template,
                filename: page?.filename || "index.html",
                inject:   page?.inject   || "body",
                context:  this.context,
            };
        }

        this.logger.info("开始转换rolldown配置");

        // 框架插件：Vue 3 SFC 支持。@vitejs/plugin-vue 是 rollup-API 兼容的 plugin，
        // rolldown 兼容 rollup plugin 接口，可以直接复用
        const frameworkPlugins: any[] = [];
        if (framework === "vue3") {
            try {
                const { default: vue } = await import("@vitejs/plugin-vue");
                frameworkPlugins.push((vue as any)());
            } catch {
                this.logger.warn("framework 为 vue3 但未安装 @vitejs/plugin-vue，跳过");
            }
        }

        return {
            input:   resolvedInput,
            output,
            plugins: [...frameworkPlugins, cssPlugin],
            // rolldown 1.0 已移除 experimental CSS 支持（issue #4271）。
            // Vue SFC 的 <style> 经 @vitejs/plugin-vue 输出含 lang.css 查询的虚拟模块，
            // 此时被 rollup-plugin-postcss 转成 JS（含 styleInject），但 URL 仍带 .css 后缀，
            // rolldown 的模块类型推断会把它当成原生 CSS → 报 UNSUPPORTED_FEATURE。
            // 显式声明 .css 视作 JS，绕过原生 CSS bundling 限制
            moduleTypes: framework === "vue3"
                ? { ".css": "js" as const }
                : undefined,
            // ── define（bundler 阶段） ──────────────────────────────────────────
            // 替换 process.env.NODE_ENV / import.meta.env.*
            define: {
                "process.env.NODE_ENV":    JSON.stringify(this.mode === "production" ? "production" : "development"),
                "import.meta.env.MODE":    JSON.stringify(this.mode === "production" ? "production" : "development"),
                "import.meta.env.PROD":    String(this.mode === "production"),
                "import.meta.env.DEV":     String(this.mode !== "production"),
                "import.meta.env.SSR":     "false",
                "import.meta.env": JSON.stringify({
                    MODE: this.mode === "production" ? "production" : "development",
                    DEV:  this.mode !== "production",
                    PROD: this.mode === "production",
                    SSR:  false,
                }),
            },
            // ── transform.define（OXC/parse 阶段）─────────────────────────────
            // EMPTY_IMPORT_META 警告在 transform 阶段（AST 解析时）触发，
            // 顶层 define 太晚，必须用 transform.define 才能在警告生成前完成替换
            transform: {
                define: {
                    "process.env.NODE_ENV":    JSON.stringify(this.mode === "production" ? "production" : "development"),
                    "import.meta.env.MODE":    JSON.stringify(this.mode === "production" ? "production" : "development"),
                    "import.meta.env.PROD":    String(this.mode === "production"),
                    "import.meta.env.DEV":     String(this.mode !== "production"),
                    "import.meta.env.SSR":     "false",
                    "import.meta.env": JSON.stringify({
                        MODE: this.mode === "production" ? "production" : "development",
                        DEV:  this.mode !== "production",
                        PROD: this.mode === "production",
                        SSR:  false,
                    }),
                },
            },
            resolve: {
                extensions: framework === "vue3"
                    ? [".ts", ".tsx", ".js", ".jsx", ".json", ".vue"]
                    : [".ts", ".tsx", ".js", ".jsx", ".json"],
                alias: Object.entries(alias).reduce((acc, [key, val]) => {
                    acc[key] = path.resolve(this.context, String(val));
                    return acc;
                }, {} as Record<string, string>),
            },
            // browser platform → rolldown 不尝试解析 Node 内置模块
            platform: rawEnvConfig.target === "node" ? "node" : "browser",
            external: isServerPass ? this.resolveServerExternals(rawEnvConfig) : (rawEnvConfig.externals || []),
            treeshake: rawEnvConfig.js?.splitChunks !== false,
            experimental: {
                enableComposingJsPlugins: true,
            },
        };
    }
    /**
     * SSR server pass externals — 委托给 shared-utils 统一实现
     */
    private resolveServerExternals(rawEnvConfig: any): any[] | ((id: string) => boolean) {
        return resolveSSRExternals(rawEnvConfig.ssr, this.context) as any[] | ((id: string) => boolean);
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
            this.logger.info("开始使用rolldown进行打包");
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
    private async devBuild(config: any): Promise<void> {
        const devCfg    = this.devServerConfig;
        const isLibrary = devCfg?.library ?? false;

        const watcher = await watch({ ...config, watch: true });

        if (isLibrary) {
            this.logger.info("rolldown library watch 模式已启动", "rolldown");
            watcher.on("event", (event: any) => {
                const code = event?.code;
                if (code === "BUNDLE_START" || code === "START")
                    this.logger.log("rolldown 开始重新构建...", "rolldown");
                if (code === "BUNDLE_END" || code === "END")
                    this.logger.done("rolldown 构建完成", "rolldown");
                if (code === "ERROR")
                    this.logger.error(`rolldown 构建错误: ${event.error}`, "rolldown");
            });
            return;
        }

        // 应用模式：watch + HTML 生成 + dev server + livereload
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

            const onBuildDone = async () => {
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
                    server.reload();
                }
            };

            watcher.on("event", async (event: any) => {
                const code = event?.code;
                if (code === "BUNDLE_START" || code === "START") {
                    this.logger.log("rolldown 开始重新构建...", "rolldown");
                }
                // 兼容 rolldown 可能用 BUNDLE_END 或 END 表示构建完成
                if (code === "BUNDLE_END" || code === "END") {
                    this.logger.done("rolldown 构建完成", "rolldown");
                    await onBuildDone();
                }
                if (code === "ERROR") {
                    this.logger.error(`rolldown 构建错误: ${event.error}`, "rolldown");
                    if (!serverStarted) resolve();
                }
            });
        });
    }

    // ─── Production build ────────────────────────────────────────────────────────
    private async prodBuild(config: any): Promise<void> {
        const outputs = Array.isArray(config.output) ? config.output : [config.output];
        const builtFiles: string[] = [];

        for (const out of outputs) {
            const result = await build({ ...config, output: out });
            const chunks = Array.isArray((result as any).output)
                ? (result as any).output.filter((o: any) => o.type === "chunk")
                : [];
            chunks.forEach((c: any) => builtFiles.push(`  ${c.fileName}`));
        }

        // 生产构建也写 HTML（应用模式）
        if (this.htmlWriteConfig) {
            writeHtmlFile(this.htmlWriteConfig);
        }

        const stats = builtFiles.join("\n");
        this.logger.done(`rolldown 生产构建完成\n${stats}`, "rolldown");
    }

    /**
     * Rolldown dev SSR middleware
     *
     * 实现：
     *   1. **Client pass**：用 rolldown.watch 编译 client bundle 写到 envConfig.output.dir，
     *      构建完成后调 writeHtmlFile 生成 dist/index.html（带 <script> 注入）。
     *   2. **Server pass**：buildSSRView 把 entry/target 切到 server，单独 watch 写到
     *      ssr.output.dir。
     *   3. **Middleware 链**：
     *        a) createStaticFileMiddleware 服务 client outDir 下的 *.js / *.css / 静态资源；
     *        b) createSSRRequestHandler 处理 HTML 请求 → require server bundle → render；
     *           getTemplate 优先读 dist/index.html（已含 <script>），否则回退源模板。
     */
    public async createSSRMiddleware(
        buildConfig: IBuildConfig,
        ctx: ISSRMiddlewareCtx,
    ): Promise<IRequestHandler[]> {
        const envConfig = buildConfig.config?.[this.mode] || buildConfig.config?.development;
        const ssrConfig = (envConfig as any)?.ssr;
        if (!ssrConfig) throw new Error("ssr config not found in envConfig");

        // ── 1) Client pass ─────────────────────────────────────────────────────
        // transformConfig 内部会按 isLibrary && !isServerPass 设置 htmlWriteConfig
        const clientConfig = await this.transformConfig(buildConfig);
        // 抓取 client 这次 transformConfig 设置的 htmlWriteConfig；server pass 不会覆盖它
        const clientHtmlConfig = this.htmlWriteConfig;
        const clientOutDir =
            (Array.isArray((clientConfig as any).output)
                ? (clientConfig as any).output[0]?.dir
                : (clientConfig as any).output?.dir)
            || path.resolve(this.context, "dist");
        const publicPath = (envConfig as any)?.publicPath || "/";

        let clientReady = false;
        let clientPending: Array<() => void> = [];
        const waitClient = () =>
            clientReady ? Promise.resolve() : new Promise<void>((r) => clientPending.push(r));

        const clientWatcher = await watch(clientConfig as any);
        clientWatcher.on("event", (event: any) => {
            const code = event?.code;
            if (code === "BUNDLE_END" || code === "END") {
                // 写 dist/index.html：把 client 产物作为 <script> 注入到源模板
                if (clientHtmlConfig) {
                    try {
                        writeHtmlFile(clientHtmlConfig);
                    } catch (e: any) {
                        this.logger.warn(`[bundlekit] SSR client HTML 写入失败: ${e.message}`, "rolldown");
                    }
                }
                clientReady = true;
                const r = clientPending; clientPending = []; r.forEach((f) => f());
            }
            if (code === "ERROR") {
                this.logger.error(`rolldown client compiler 错误: ${event.error}`, "rolldown");
            }
        });

        // ── 2) Server pass ─────────────────────────────────────────────────────
        const serverBuildConfig = buildSSRView(buildConfig, this.mode);
        const serverConfig = await this.transformConfig(serverBuildConfig);

        const serverOutDir = path.resolve(this.context, ssrConfig.output.dir);
        const serverFilename = ssrConfig.output.filename || "server.cjs";
        const serverBundlePath = path.resolve(serverOutDir, serverFilename);

        let serverReady = false;
        let serverPending: Array<() => void> = [];
        const waitServer = () =>
            serverReady ? Promise.resolve() : new Promise<void>((r) => serverPending.push(r));

        const serverWatcher = await watch(serverConfig as any);
        serverWatcher.on("event", (event: any) => {
            const code = event?.code;
            if (code === "BUNDLE_END" || code === "END") {
                serverReady = true;
                const r = serverPending; serverPending = []; r.forEach((f) => f());
            }
            if (code === "ERROR") {
                this.logger.error(`rolldown server compiler 错误: ${event.error}`, "rolldown");
            }
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
            // SSR 请求必须等 client + server 都就绪：client 还没产 dist/index.html 时，
            // 直接用源模板会丢 <script>，浏览器仍然不能 hydrate。
            waitUntilReady: async () => {
                await waitClient();
                await waitServer();
            },
            getTemplate: async () => {
                // 优先用 client pass 写出的 dist/index.html（自带 <script>）
                const compiled = path.join(clientOutDir, "index.html");
                if (existsSync(compiled)) {
                    return readFileSync(compiled, "utf-8");
                }
                // 回退源模板（一般是用户删了 pages 的边界情况）
                const templatePath = ssrConfig.template
                    ? path.resolve(this.context, ssrConfig.template)
                    : path.resolve(this.context, "public/index.html");
                return readFileSync(templatePath, "utf-8");
            },
            onError: (e) => this.logger.error(`SSR 渲染失败: ${e?.message ?? e}`, "rolldown"),
        });

        return [staticMW, ssrHandler];
    }
}
