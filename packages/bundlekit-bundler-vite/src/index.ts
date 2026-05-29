import path from "path";
import react from '@vitejs/plugin-react';

import { build, createServer } from "vite";
import { createHtmlPlugin } from 'vite-plugin-html';
import { Logger, validateBuildConfig } from "@bundlekit/shared-utils";

import type { Plugin, InlineConfig } from "vite";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv } from "@bundlekit/shared-utils";

/**
 * 从字符串 entry 派生 chunk 名（去目录、去扩展名）。和 webpack/rspack 适配器保持
 * 一致，避免 [name].js 永远输出 app.js 与模板 main 字段错位。
 */
function deriveChunkName(entry: string): string {
    const base = path.basename(entry, path.extname(entry));
    return base || "app";
}

export default class ViteBundler implements IBuildToolAdapter<InlineConfig> {

    public name: string = "@bundlekit/bundler-vite";
    private mode: IBuildEnv;
    private logger: Logger = new Logger();
    private context: string;

    constructor(api: IService, mode: IBuildEnv) {
        this.mode = mode;
        this.context = api.context || process.cwd();
    }

    /**
     * 把抽象层config配置转换成实际bundler支持的vite配置
     * @param config IBuildConfig 抽象层config配置
     * @returns Configuration vite配置
     */
    private async getFormatViteConfig(config: IBuildConfig = {} as IBuildConfig) {

        const rawEnvConfig = config.config?.[this.mode] || config.config?.development || {};
        const envConfig = rawEnvConfig as Record<string, any>;

        const entry = envConfig.entry
            ? (typeof envConfig.entry === "string"
                ? { [deriveChunkName(envConfig.entry)]: envConfig.entry }
                : envConfig.entry)
            : { app: path.resolve(this.context, "src/index.tsx") };

        const outDir = (envConfig.output && !Array.isArray(envConfig.output) ? envConfig.output.dir : undefined)
            || (Array.isArray(envConfig.output) ? envConfig.output[0]?.dir : undefined)
            || "dist";

        const rawFormats = envConfig.output && !Array.isArray(envConfig.output) ? envConfig.output.formats : undefined;
        const formatMap: Record<string, string> = { umd: 'umd', commonjs: 'cjs', esm: 'es', es: 'es', iife: 'iife' };
        const outputFormat = formatMap[(Array.isArray(rawFormats) ? rawFormats[0] : rawFormats) as string] || 'es';

        const devServer = envConfig.devServer || {};
        const alias = envConfig.alias || {};
        const jsConfig = envConfig.js || {};
        const pages = envConfig.pages || [];
        const framework = envConfig.framework as string | undefined;

        /** 按 framework 动态加载框架插件，避免硬编码 */
        const frameworkPlugins: Plugin[] = [];
        if (framework === "react") {
            frameworkPlugins.push(...([] as Plugin[]).concat(react() as unknown as Plugin[]));
        } else if (framework === "vue3") {
            try {
                const { default: vue } = await import("@vitejs/plugin-vue");
                frameworkPlugins.push(vue());
            } catch {
                this.logger.warn("framework 为 vue3 但未安装 @vitejs/plugin-vue，跳过");
            }
        }

        const rollupInput: Record<string, string> = {};
        for (const page of pages) {
            const name = page.filename.replace(/\.html$/, "");
            rollupInput[name] = path.resolve(this.context, page.template);
        }

        /**
         * vite-plugin-html 的 isMpa() 仅在 rollupOptions.input 条目 >1 时返回 true。
         * 单页面时走 SPA 分支，必须使用顶层 template/entry，不能用 pages 数组。
         * entry 需要是根路径相对路径（如 "/src/index.tsx"），不能用绝对路径，
         * 否则浏览器收到的 script.src 会是文件系统路径，导致页面空白。
         */
        const buildHtmlPlugin = () => {
            if (pages.length === 1) {
                // SPA：使用顶层 template + entry
                return createHtmlPlugin({
                    minify: false,
                    template: pages[0].template,
                    entry: `/${pages[0].entry}`,
                });
            }
            if (pages.length > 1) {
                // MPA：使用 pages 数组，entry 必须根路径相对
                return createHtmlPlugin({
                    minify: false,
                    pages: pages.map((page: any) => ({
                        filename: page.filename,
                        template: page.template,
                        entry: `/${page.entry}`,
                    })),
                });
            }
            // 无 pages 配置：退回默认
            return createHtmlPlugin({ minify: false });
        };

        // SSR server pass：仅在 buildSSRView 注入 __isServerPass=true 时启用
        // vite 原生 build.ssr。单纯 target=node（如 node-ts 库模板）不再被
        // 误判为 SSR pass — 它们走下面 application/library 输出分支。
        const isServerPass = envConfig.__isServerPass === true;
        const ssrConfig = envConfig.ssr;

        // Library 模式：library=true 走 vite 原生 build.lib（支持多格式 + UMD name）
        const isLibrary = envConfig.library === true;
        const libraryName = envConfig.libraryName as string | undefined;
        // build.lib.formats 接收 vite 自己的 token（es/cjs/umd/iife）
        const libFormats: string[] = (() => {
            const arr = Array.isArray(rawFormats) ? rawFormats : (rawFormats ? [rawFormats] : ['es']);
            return arr.map((f: string) => formatMap[f] || f);
        })();
        // entry 文件名（去后缀）—— 用于 build.lib.fileName 默认值
        const firstEntryRaw = typeof envConfig.entry === "string" ? envConfig.entry : Object.values(envConfig.entry || { app: "src/index.ts" })[0] as string;
        const libEntryAbs = path.resolve(this.context, firstEntryRaw);
        const libBaseName = (() => {
            const base = path.basename(firstEntryRaw).replace(/\.[^.]+$/, "");
            return libraryName || base || "index";
        })();
        // SDK 默认把 dependencies / peerDependencies 视为 external（避免把 react / vue 打进来）
        const libExternals: (string | RegExp)[] = (() => {
            const explicit = Array.isArray(envConfig.externals) ? envConfig.externals : [];
            if (!isLibrary) return explicit;
            try {
                const fs = require("node:fs");
                const pkgPath = path.resolve(this.context, "package.json");
                if (fs.existsSync(pkgPath)) {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                    const auto = [
                        ...Object.keys(pkg.peerDependencies || {}),
                        ...Object.keys(pkg.dependencies || {}),
                    ];
                    return [...new Set([...explicit, ...auto])];
                }
            } catch { /* ignore */ }
            return explicit;
        })();

        const viteConfig = {
            base: envConfig.publicPath || "/",
            publicDir: false,
            root: path.resolve(this.context),
            mode: this.mode === "development" ? "development" : "production",
            configFile: false,
            resolve: {
                extensions: ['.tsx', '.ts', '.js', '.mjs', '.mts', '.jsx', '.json', '.less', '.scss', '.css'],
                alias: Object.entries(alias).reduce((acc, [key, val]) => {
                    acc[key] = path.resolve(this.context, String(val));
                    return acc;
                }, {} as Record<string, string>),
            },
            css: {
                modules: { localsConvention: 'camelCase' },
                preprocessorOptions: {
                    less: { javascriptEnabled: true },
                    scss: {},
                },
            },
            ...(isServerPass ? {} : {
                server: {
                    open: devServer.open !== undefined ? devServer.open : true,
                    host: devServer.host || '0.0.0.0',
                    port: devServer.port || 3000,
                    https: devServer.https || false,
                    proxy: Object.entries(devServer.proxy || {}).reduce((acc, [key, val]: [string, any]) => {
                        acc[key] = { target: val.target, changeOrigin: val.changeOrigin ?? true, secure: val.secure ?? false };
                        return acc;
                    }, {} as Record<string, any>),
                    allowedHosts: ['*'],
                    strictPort: true,
                    hmr: true,
                    cors: true,
                    watch: {
                        usePolling: true,
                        interval: 100
                    }
                },
            }),
            plugins: isServerPass || isLibrary || envConfig.target === 'node'
                ? [...frameworkPlugins]   // server / library / node 库都不需要 HTML plugin
                : [...frameworkPlugins, buildHtmlPlugin()],
            build: {
                outDir: outDir,
                assetsDir: 'assets',
                sourcemap: jsConfig.sourcemap || false,
                minify: isServerPass ? false : (jsConfig.minify ? 'terser' : false),
                ...(jsConfig.minify && !isServerPass && {
                    terserOptions: {
                        compress: {
                            drop_console: true,
                            drop_debugger: true
                        }
                    }
                }),
                ...(isServerPass ? {
                    // vite 原生 SSR 模式
                    ssr: typeof envConfig.entry === "string"
                        ? path.resolve(this.context, envConfig.entry)
                        : path.resolve(this.context, ssrConfig?.entry || "src/entry-server.tsx"),
                    rollupOptions: {
                        output: {
                            format: ssrConfig?.output?.formats === "esm" ? "es" : "cjs",
                            entryFileNames: ssrConfig?.output?.filename || "server.cjs",
                        },
                    },
                } : isLibrary ? {
                    // Vite 原生 library 模式（支持多格式 + UMD name）
                    lib: {
                        entry: libEntryAbs,
                        formats: libFormats as any,
                        // UMD/IIFE 必须有 name
                        ...(libFormats.includes('umd') || libFormats.includes('iife')
                            ? { name: libraryName || libBaseName }
                            : {}),
                        fileName: (format: string, name: string) => {
                            const ext = format === 'es' ? 'mjs' : format === 'cjs' ? 'cjs' : `${format}.js`;
                            return `${libBaseName}.${ext}`;
                        },
                    },
                    rollupOptions: {
                        external: libExternals,
                        output: {
                            // UMD/IIFE 需要 globals 映射，但用户可在 .bundlekitrc 覆写；
                            // 这里只为 react/react-dom/vue 提供常见映射
                            globals: libExternals.reduce<Record<string, string>>((acc, ext) => {
                                if (typeof ext !== "string") return acc;
                                if (ext === "react") acc[ext] = "React";
                                else if (ext === "react-dom") acc[ext] = "ReactDOM";
                                else if (ext === "vue") acc[ext] = "Vue";
                                return acc;
                            }, {}),
                        },
                    },
                } : {
                    rollupOptions: {
                        input: pages.length > 0 ? rollupInput : entry,
                        output: (() => {
                            // target=node 但非 SSR / 非 library（如 node-ts 默认模板）：
                            //   - 不出 HTML / assets 目录
                            //   - 用 envConfig.output.filename 作为 entryFileNames，
                            //     默认 [name].js → dist/index.js（chunk 名 = entry basename，
                            //     由 input map 决定）
                            //   - format 跟随 outputFormat（ESM / CJS）
                            const isNodeLibLike = envConfig.target === 'node';
                            const baseFilename = (envConfig.output && !Array.isArray(envConfig.output)
                                ? (envConfig.output as any).filename
                                : undefined) || '[name].js';
                            return {
                                ...(['umd', 'iife'].includes(outputFormat) ? {} : { format: outputFormat }),
                                manualChunks: (jsConfig.splitChunks && !['umd', 'iife'].includes(outputFormat) && !isNodeLibLike) ? {
                                    'react-vendor': ['react', 'react-dom'],
                                } : undefined,
                                chunkFileNames: isNodeLibLike ? baseFilename : 'assets/js/[name]-[hash].js',
                                entryFileNames: isNodeLibLike ? baseFilename : 'assets/js/[name]-[hash].js',
                                assetFileNames: isNodeLibLike ? baseFilename.replace(/\[name\]/g, '[name]') : 'assets/[ext]/[name]-[hash].[ext]',
                            } as Record<string, any>;
                        })(),
                        onwarn: (warning, warn) => {
                            if (warning.code === 'ERROR') {
                                this.logger.error(`构建过程中出现错误: ${warning.message}`);
                            }
                            if (warning.code === 'CIRCULAR_DEPENDENCY') return;
                            warn(warning);
                        }
                    }
                }),
            },
        };
        return viteConfig;
    }
    /**
     * 转换bundler配置处理成vite配置
     * @param config IBuildConfig 抽象层config配置
     * @returns InlineConfig vite配置
     */
    public async transformConfig(config: IBuildConfig) {
        this.logger.info(`开始转换vite配置`);
        const viteConfig = await this.getFormatViteConfig(config);
        return viteConfig as InlineConfig;
    }

    /**
     * 校验vite配置是否合法
     * @param config InlineConfig vite配置
     * @returns boolean
     */
    public validateConfig(config: InlineConfig, buildConfig?: IBuildConfig) {
        if (buildConfig) return validateBuildConfig(buildConfig, this.mode).valid;
        return true;
    };

    public async run(config: InlineConfig) {
        switch (this.mode) {
            case "development":
                const server = await createServer(config as InlineConfig);
                await server.listen();
                server.printUrls();
                break;
            case "production":
            case "gray":
            case "test":
            case "staging":
                await build(config as InlineConfig);
                break;
            default:
                this.logger.error(`Invalid mode: ${this.mode}`);
                break;
        }
    }

    /**
     * Vite 原生 dev SSR middleware
     *
     * 启用条件：用户在 envConfig.ssr 上设 dev=true，service 调用此方法获取 middleware 链
     * 然后由 service 启动 HTTP server 把这些 middleware 串起来。
     *
     * 实现原理：
     *   - createServer({ middlewareMode: true }) 拿到 vite 实例（不绑定端口）
     *   - 返回 [vite.middlewares, ssrHandler] middleware 链
     *   - ssrHandler 用 transformIndexHtml + ssrLoadModule 渲染并注入 HMR client script
     */
    public async createSSRMiddleware(buildConfig: IBuildConfig): Promise<any[]> {
        const path = await import("node:path");
        const fs = await import("node:fs");
        const envConfig = (buildConfig.config?.[this.mode] || buildConfig.config?.development) as any;
        const ssrConfig = envConfig?.ssr;
        if (!ssrConfig) throw new Error("ssr config not found in envConfig");

        const inlineConfig = (await this.transformConfig(buildConfig)) as InlineConfig;

        const vite = await createServer({
            ...inlineConfig,
            server: { ...((inlineConfig as any).server || {}), middlewareMode: true },
            appType: "custom",
        } as any);

        const placeholder = ssrConfig.placeholder || "<!--ssr-outlet-->";
        const templatePath = ssrConfig.template
            ? path.resolve(this.context, ssrConfig.template)
            : path.resolve(this.context, "public/index.html");

        const ssrHandler = async (req: any, res: any, next: any) => {
            try {
                const url = req.url || "/";
                let template = fs.readFileSync(templatePath, "utf-8");
                template = await vite.transformIndexHtml(url, template);

                const serverEntryPath = path.resolve(this.context, ssrConfig.entry);
                const mod = await vite.ssrLoadModule(serverEntryPath);
                const render = (mod as any).render || (mod as any).default?.render;
                if (typeof render !== "function") {
                    throw new Error(`${ssrConfig.entry} 必须 export 一个 \`render(url): string | Promise<string>\` 函数`);
                }
                const appHtml = await render(url);
                const html = template.includes(placeholder)
                    ? template.replace(placeholder, appHtml)
                    : template.replace(/<\/body>/i, `${appHtml}</body>`);

                res.statusCode = 200;
                res.setHeader("Content-Type", "text/html");
                res.end(html);
            } catch (err: any) {
                vite.ssrFixStacktrace(err);
                this.logger.error(`SSR 渲染失败: ${err?.message ?? err}`);
                res.statusCode = 500;
                res.setHeader("Content-Type", "text/html; charset=utf-8");
                res.end(`<pre>${(err?.stack || err?.message || String(err))
                    .replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`);
            }
        };

        return [vite.middlewares, ssrHandler];
    }
}