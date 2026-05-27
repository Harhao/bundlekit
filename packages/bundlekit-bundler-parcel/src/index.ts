import path from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { createRequire } from "module";
import { Parcel, createWorkerFarm } from "@parcel/core";

import {
    Logger,
    validateBuildConfig,
    createSSRRequestHandler,
    buildSSRView,
    resolveSSRExternals,
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

// ─── HTML 写入配置 ────────────────────────────────────────────────────────────
interface HtmlWriteConfig {
    outDir: string;
    template?: string;
    filename: string;
    inject: "head" | "body";
    context: string;
}

/** 根据配置生成并写入 index.html（Parcel 只产出 JS/CSS bundle，需手动写 HTML） */
function writeHtmlFile(opts: HtmlWriteConfig): void {
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

// ─── 运行时保留的 devServer 配置 ─────────────────────────────────────────────
interface StoredDevServerConfig {
    host: string;
    port: number;
    open: boolean;
    proxy: Record<string, any>;
    outDir: string;
    library: boolean;
}

// ─── 最终传入 Parcel 的配置形态 ─────────────────────────────────────────────
interface ParcelRunConfig {
    entries: string[];
    distDir: string;
    outDir: string;
    target: "browser" | "node";
    env: Record<string, string>;
    minify: boolean;
    sourceMaps: boolean;
    library: boolean;
    ssrServerEntry?: string;
    ssrOutDir?: string;
    ssrFilename?: string;
}

/**
 * Parcel 2 适配器。
 *
 * Parcel 走零配置理念，`transformConfig` 阶段仅提取 bundlekit 配置里的关键字段
 * 映射到 Parcel 的 `new Parcel({ ...})` 初始化参数，不生成 parcelrc 文件。
 * 实际的 Parcel 实例在 `run()` 阶段创建（Parcel 要求 entry 确定后才能实例化）。
 */
export default class ParcelBundler implements IBuildToolAdapter {

    private context: string;
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    private devServerConfig: StoredDevServerConfig | null = null;
    private htmlWriteConfig: HtmlWriteConfig | null = null;
    public name: string = "@bundlekit/bundler-parcel";

    constructor(api: IService, mode: IBuildEnv) {
        this.mode    = mode;
        this.context = api.context || process.cwd();
    }

    public transformConfig(config: IBuildConfig): ParcelRunConfig {
        const rawEnvConfig = (
            config.config?.[this.mode] || config.config?.development || {}
        ) as Record<string, any>;

        // ── SSR server pass 检测 ──────────────────────────────────────────────
        const isServerPass = rawEnvConfig.target === "node";

        // ── Entry ────────────────────────────────────────────────────────────
        const entry = rawEnvConfig.entry
            ? typeof rawEnvConfig.entry === "string"
                ? [rawEnvConfig.entry]
                : Object.values(rawEnvConfig.entry as Record<string, string>)
            : ["src/index.tsx"];

        const entries = (entry as string[]).map((e) => path.resolve(this.context, e));

        // ── Output dir ───────────────────────────────────────────────────────
        const outDirRel =
            (!Array.isArray(rawEnvConfig.output) && rawEnvConfig.output?.dir) ||
            (Array.isArray(rawEnvConfig.output) && rawEnvConfig.output[0]?.dir) ||
            "dist";
        const outDir = path.resolve(this.context, outDirRel);

        // ── JS options ───────────────────────────────────────────────────────
        const jsConfig  = rawEnvConfig.js  || {};
        const isLibrary = rawEnvConfig.library === true;
        const minify    = jsConfig.minify   ?? this.mode === "production";
        const sourceMaps= jsConfig.sourcemap ?? false;

        // ── Environment defines ──────────────────────────────────────────────
        const env: Record<string, string> = {
            NODE_ENV: this.mode === "production" ? "production" : "development",
        };

        // ── DevServer config ─────────────────────────────────────────────────
        this.devServerConfig = {
            host:    rawEnvConfig.devServer?.host  ?? "0.0.0.0",
            port:    rawEnvConfig.devServer?.port  ?? 3000,
            open:    rawEnvConfig.devServer?.open  ?? false,
            proxy:   rawEnvConfig.devServer?.proxy ?? {},
            outDir,
            library: isLibrary,
        };

        this.logger.info("开始转换 Parcel 配置");

        // ── HTML 写入配置（仅应用模式，SSR server pass 和 library 不需要）───────
        if (!isLibrary && !isServerPass) {
            const pages = rawEnvConfig.pages as Array<{
                template?: string;
                filename?: string;
                inject?: "head" | "body";
            }> | undefined;
            const page = pages?.[0];
            this.htmlWriteConfig = {
                outDir:   outDir,
                template: page?.template,
                filename: page?.filename || "index.html",
                inject:   page?.inject   || "body",
                context:  this.context,
            };
        }

        // ── SSR server pass 返回值 ─────────────────────────────────────────
        if (isServerPass) {
            const ssrCfg = rawEnvConfig.ssr;
            return {
                entries,
                distDir:  outDir,
                outDir,
                target:   "node",
                env,
                minify:   false,
                sourceMaps: false,
                library:  true,
                ssrServerEntry: ssrCfg?.entry
                    ? path.resolve(this.context, ssrCfg.entry)
                    : entries[0],
                ssrOutDir:  ssrCfg?.output?.dir
                    ? path.resolve(this.context, ssrCfg.output.dir)
                    : path.resolve(outDir, "server"),
                ssrFilename: ssrCfg?.output?.filename || "server.cjs",
            };
        }

        return {
            entries,
            distDir: outDir,
            outDir,
            target: "browser",
            env,
            minify,
            sourceMaps,
            library: isLibrary,
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

    public async run(config: ParcelRunConfig): Promise<void> {
        try {
            this.logger.info("开始使用 Parcel 进行打包");
            switch (this.mode) {
                case "development": await this.devBuild(config);  break;
                case "production":
                case "test":
                case "staging":
                case "gray":        await this.prodBuild(config); break;
                default: break;
            }
        } catch (e) {
            this.logger.error(`Parcel 打包失败, 错误信息: ${e}`);
            throw e;
        }
    }

    // ─── Development build：watch + DevServer ────────────────────────────────
    private async devBuild(config: ParcelRunConfig): Promise<void> {
        const devCfg    = this.devServerConfig;
        const isLibrary = devCfg?.library ?? false;

        const bundler = new Parcel({
            entries:      config.entries,
            defaultConfig: "@parcel/config-default",
            mode: "development",
            targets: {
                default: {
                    distDir:    config.distDir,
                    context:    config.target === "node" ? "node" : "browser",
                    outputFormat: isLibrary ? "commonjs" : "global",
                    engines: config.target === "node"
                        ? { node: ">=18" }
                        : { browsers: ["> 0.5%", "last 2 versions"] },
                    includeNodeModules: config.target !== "node",
                    scopeHoist: false,
                },
            },
            env: config.env,
            workerFarm: createWorkerFarm(),
            shouldDisableCache: false,
            shouldAutoInstall: false,
            logLevel: "warn",
        } as any);

        if (isLibrary) {
            // Library watch 模式，不启动 DevServer
            this.logger.info("Parcel library watch 模式已启动", "parcel");
            const subscription = await bundler.watch((err: any) => {
                if (err) {
                    this.logger.error(`Parcel 构建错误: ${err}`, "parcel");
                } else {
                    this.logger.done("Parcel 构建完成", "parcel");
                }
            });
            // 保持进程不退出
            await new Promise<void>(() => {
                process.on("SIGINT", async () => {
                    await subscription.unsubscribe();
                    process.exit(0);
                });
            });
            return;
        }

        // 应用模式：watch + DevServer
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

            bundler.watch(async (err: any) => {
                if (err) {
                    this.logger.error(`Parcel 构建错误: ${err}`, "parcel");
                    if (!serverStarted) resolve();
                    return;
                }
                this.logger.done("Parcel 构建完成", "parcel");
                // 每次构建成功后写 HTML（保证 index.html 与 JS 同步）
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
            });
        });
    }

    // ─── Production build ─────────────────────────────────────────────────────
    private async prodBuild(config: ParcelRunConfig): Promise<void> {
        const workerFarm = createWorkerFarm();
        try {
            const bundler = new Parcel({
                entries:       config.entries,
                defaultConfig: "@parcel/config-default",
                mode: "production",
                targets: {
                    default: {
                        distDir:    config.distDir,
                        context:    config.target === "node" ? "node" : "browser",
                        outputFormat: config.library ? "commonjs" : "global",
                        engines: config.target === "node"
                            ? { node: ">=18" }
                            : { browsers: ["> 0.5%", "last 2 versions"] },
                        includeNodeModules: config.target !== "node",
                        optimize: config.minify,
                        scopeHoist: !config.library,
                    },
                },
                env:         config.env,
                workerFarm,
                shouldDisableCache: false,
                shouldAutoInstall:  false,
                logLevel: "warn",
            } as any);

            const { bundleGraph } = await bundler.run();
            const bundles = bundleGraph.getBundles();
            const stats = bundles.map((b: any) => `  ${b.displayName || b.filePath}`).join("\n");
            this.logger.done(`Parcel 生产构建完成\n${stats}`, "parcel");
            // 生产构建也写 HTML（应用模式）
            if (this.htmlWriteConfig) {
                writeHtmlFile(this.htmlWriteConfig);
            }
        } finally {
            await workerFarm.end();
        }
    }

    /**
     * Parcel dev SSR middleware
     *
     * 实现思路（与 rolldown 镜像）：
     *   1. server bundle 用 Parcel.watch 持续监听并写到磁盘
     *   2. 从 buildSuccess 事件的 bundleGraph 动态获取实际产物路径
     *   3. ssrHandler 每次请求等编译就绪 → 清 require cache → require → render
     */
    public async createSSRMiddleware(
        buildConfig: IBuildConfig,
        _ctx: ISSRMiddlewareCtx,
    ): Promise<IRequestHandler[]> {
        const envConfig = buildConfig.config?.[this.mode] || buildConfig.config?.development;
        const ssrConfig = (envConfig as any)?.ssr;
        if (!ssrConfig) throw new Error("ssr config not found in envConfig");

        // 生成 server pass 的 buildConfig，然后 transformConfig
        const serverBuildConfig = buildSSRView(buildConfig, this.mode);
        const serverRunConfig   = this.transformConfig(serverBuildConfig) as ParcelRunConfig;

        const serverOutDir     = path.resolve(this.context, ssrConfig.output.dir);
        const serverFilename   = ssrConfig.output.filename || "server.cjs";
        // 预期路径（fallback）；Parcel 成功后会用 bundleGraph 覆盖
        let resolvedBundlePath = path.resolve(serverOutDir, serverFilename);

        let serverReady = false;
        let pending: Array<() => void> = [];
        const waitUntilReady = () =>
            serverReady
                ? Promise.resolve()
                : new Promise<void>((r) => pending.push(r));

        // 确保输出目录存在
        mkdirSync(serverOutDir, { recursive: true });

        // 启动 Parcel server-side watcher
        const workerFarm = createWorkerFarm();
        const bundler = new Parcel({
            entries:       serverRunConfig.entries,
            defaultConfig: "@parcel/config-default",
            mode: "development",
            targets: {
                default: {
                    distDir:      serverOutDir,
                    context:      "node",
                    outputFormat: "commonjs",
                    engines:      { node: ">=18" },
                    includeNodeModules: false,
                    scopeHoist: false,
                },
            },
            env:         serverRunConfig.env,
            workerFarm,
            shouldDisableCache: false,
            shouldAutoInstall:  false,
            logLevel: "warn",
        } as any);

        // Parcel 2 watch 回调签名: (err: Error | null, event: BuildSuccessEvent | BuildFailureEvent) => void
        await bundler.watch((err: Error | null, event: any) => {
            if (err || event?.type === "buildFailure") {
                const msg = err?.message ?? event?.diagnostics?.[0]?.message ?? String(err ?? event);
                this.logger.error(`Parcel server compiler 错误: ${msg}`, "parcel");
                return;
            }
            if (event?.type === "buildSuccess") {
                // 从 bundleGraph 动态获取实际产物路径（Parcel 可能重命名文件）
                try {
                    const bundles: any[] = event.bundleGraph?.getBundles?.() ?? [];
                    const entryBundle = bundles.find(
                        (b: any) => b.isEntry && (b.filePath?.endsWith(".cjs") || b.filePath?.endsWith(".js")),
                    ) ?? bundles[0];
                    if (entryBundle?.filePath) {
                        resolvedBundlePath = entryBundle.filePath;
                    }
                } catch {
                    // bundleGraph API 不可用时回落到预期路径
                }
                serverReady = true;
                const r = pending; pending = []; r.forEach((f) => f());
            }
        });

        const ssrHandler = createSSRRequestHandler({
            context:          this.context,
            ssrConfig,
            serverBundlePath: () => resolvedBundlePath,
            waitUntilReady,
            onError: (e) =>
                this.logger.error(`SSR 渲染失败: ${e?.message ?? e}`, "parcel"),
        });

        return [ssrHandler];
    }
}
