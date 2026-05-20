import path from "path";
import react from '@vitejs/plugin-react';

import { build, createServer } from "vite";
import { createHtmlPlugin } from 'vite-plugin-html';
import { Logger, validateBuildConfig } from "@devkit/shared-utils";

import type { Plugin, InlineConfig } from "vite";
import type { IBuildConfig, IBuildToolAdapter, IService, IBuildEnv } from "@devkit/shared-utils";

export default class ViteBundler implements IBuildToolAdapter<InlineConfig> {

    public name: string = "@devkit/bundler-vite";
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
                ? { app: envConfig.entry }
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
            plugins: [
                ...frameworkPlugins,
                buildHtmlPlugin(),
            ],
            build: {
                outDir: outDir,
                assetsDir: 'assets',
                sourcemap: jsConfig.sourcemap || false,
                minify: jsConfig.minify ? 'terser' : false,
                ...(jsConfig.minify && {
                    terserOptions: {
                        compress: {
                            drop_console: true,
                            drop_debugger: true
                        }
                    }
                }),
                rollupOptions: {
                    input: pages.length > 0 ? rollupInput : entry,
                    output: {
                        // umd/iife 不支持代码分割，不设置 format 和 manualChunks，由 vite 自行处理
                        ...(['umd', 'iife'].includes(outputFormat) ? {} : { format: outputFormat }),
                        manualChunks: (jsConfig.splitChunks && !['umd', 'iife'].includes(outputFormat)) ? {
                            'react-vendor': ['react', 'react-dom'],
                        } : undefined,
                        chunkFileNames: 'assets/js/[name]-[hash].js',
                        entryFileNames: 'assets/js/[name]-[hash].js',
                        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
                    },
                    onwarn: (warning, warn) => {
                        if (warning.code === 'ERROR') {
                            this.logger.error(`构建过程中出现错误: ${warning.message}`);
                        }
                        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
                        warn(warning);
                    }
                }
            }
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
}