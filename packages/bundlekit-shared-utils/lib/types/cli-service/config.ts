import { IBuildTools } from "./adapter";
import { IBuildEnv } from "./env";

export type IBuildFramework = "react" | "vue3";

export type IBuildFormat = "esm" | "commonjs" | "umd" | "iife";

/**
 * Tools 钩子的上下文：传递给 tools[bundler]?(config, ctx) 的第二个参数
 */
export interface IToolsCtx {
    /** 构建模式 */
    mode: IBuildEnv;
    /** 当前命令（serve / build） */
    command: "serve" | "build";
    /**
     * 当前 pass 是 client 还是 server。
     * 默认 'client'；启用 SSR 后，server pass 会传 'server'（由 change add-ssr-support 启用）
     */
    env: "client" | "server";
    /** 当前激活的 bundler 短名 */
    bundler: IBuildTools;
}

/**
 * bundler 短名到原生 config 类型的映射。
 *
 * 类型层使用 `import type` 引用各 bundler 包，避免 shared-utils 在运行时依赖任何
 * 具体的 bundler 包（与 refactor-bundler-deps 一致）。当用户没有装某个 bundler 时，
 * 通过 tsconfig 的 `skipLibCheck` + 条件 `unknown` fallback 不会产生错误。
 */
export type IBundlerConfigMap = {
    webpack: import("webpack").Configuration;
    vite: import("vite").InlineConfig;
    rspack: import("@rspack/core").RspackOptions;
    rollup: import("rollup").RollupOptions;
    rolldown: unknown;
    parcel: unknown;
};

/**
 * Tools 字段：按 bundler 分块的逃生舱钩子
 *
 * 调用时机：transformConfig → tools[bundler] → changeConfigure → run
 *
 * 返回值约定：
 *   - 返回 undefined / void → 用 mutate 后的 config
 *   - 返回新对象           → 用新对象替换
 */
export type IToolsHooks = {
    [K in IBuildTools]?: (
        config: IBundlerConfigMap[K],
        ctx: IToolsCtx,
    ) => IBundlerConfigMap[K] | void | Promise<IBundlerConfigMap[K] | void>;
};

export interface IBuildPageConfig {
    /** HTML 模板路径 */
    template: string;
    /** 输出 HTML 文件名 */
    filename: string;
    /** 页面入口文件（vite 使用） */
    entry?: string;
    /** script 注入位置 */
    inject?: "head" | "body";
}

/**
 * SSR 配置：双产物模式，客户端 + 服务端各一份 bundle。
 *
 * 启用条件：在某个 envConfig 上声明 `ssr` 字段。该 env 下 `target` 必须保持 'web'，
 * `pages[]` 不能与 `ssr` 同时存在（互斥）。
 */
export interface ISSRConfig {
    /** server 入口（如 src/entry-server.tsx），需 export `render(url): string | Promise<string>` */
    entry: string;
    /** server bundle 输出配置 */
    output: {
        /** server bundle 输出目录（如 dist/server） */
        dir: string;
        /** server bundle 文件名（如 server.cjs） */
        filename: string;
        /** server bundle 输出格式（commonjs / esm） */
        formats: "commonjs" | "esm";
    };
    /** 外部依赖处理：'auto' 表示把 node_modules 全部 externalize；数组则按规则匹配 */
    externals?: "auto" | (string | RegExp)[];
    /** HTML 模板路径（默认 public/index.html） */
    template?: string;
    /** 占位符（默认 "<!--ssr-outlet-->"） */
    placeholder?: string;
    /** 是否启用 dev SSR middleware（默认 false，开发态走 client-only） */
    dev?: boolean;
}

export interface IBuildOutput {
    /** 输出目录 */
    dir: string;
    /** 输出文件名 */
    filename: string;
    /** 输出格式 */
    formats: IBuildFormat | IBuildFormat[];
}

export interface IEnvBuildConfig {
    /** 构建工具 */
    bundler?: IBuildTools;
    /** 构建目标平台 */
    target?: 'web' | 'node';
    /** 公共路径 */
    publicPath: string;
    /** 入口文件 */
    entry: string | Record<string, string>;
    /** 输出配置 */
    output: IBuildOutput | IBuildOutput[];
    /** JS相关配置 */
    js?: {
        /** 是否启用sourcemap */
        sourcemap?: boolean;
        /** 是否启用压缩 */
        minify?: boolean;
        /** 是否启用代码分割 */
        splitChunks?: boolean;
    };
    /** CSS相关配置 */
    css?: {
        /** 是否启用预加载 */
        preload?: boolean;
        /** 是否启用sourcemap */
        sourcemap?: boolean;
        /** 是否启用css modules */
        modules?: boolean;
        /** 是否启用css提取 */
        extract?: boolean;
        /** css预处理器 */
        loaders?: string[];
    };
    /** 是否启用analyzer */
    analyzer?: boolean;
    /** 别名配置 */
    alias?: Record<string, string>;
    /** 外部依赖 */
    externals: string | RegExp | (string | RegExp)[];
    /** 开发服务器配置 */
    devServer?: {
        /** 是否自动打开浏览器 */
        open: boolean;
        /** 是否启用代理 */
        proxy: Record<string, unknown>[] | Record<string, unknown>;
        /** 是否启用https */
        https: boolean;
        /** 主机地址 */
        host: string;
        /** 端口号 */
        port: number;
    };
    /** 资源注入配置 */
    inject?: {
        /** 需要注入的JS文件 */
        js?: Partial<{
            /** 需要注入的JS文件 */
            src: string;
            /** 需要注入的JS内容 */
            content: string;
            /** 是否延迟执行 */
            defer: boolean;
            /** 是否异步执行 */
            async: boolean;
        }>[];
        /** 需要注入的CSS文件 */
        css?: Partial<{
            /** 需要注入的CSS文件路径 */
            href: string;
            /** 需要注入的CSS内容 */
            content: string;
            /** 注入方式：link标签或style标签 */
            type: 'link' | 'style';
            /** 是否启用预加载 */
            preload: boolean;
        }>[];
        /** 注入位置 */
        position?: 'head' | 'body';
    };
    /** 资源拷贝配置 */
    copy?: {
        /** 需要拷贝的文件或目录 */
        from: string | string[];
        /** 目标目录 */
        to: string;
        /** 忽略规则：指定不需要复制的文件或目录，支持 glob 模式 */
        ignore?: string | string[];
        /** 扁平化：是否保持源文件的目录结构，false 时会将文件复制到目标目录的根目录 */
        flatten?: boolean;
    }[];
    /** 多页面配置 */
    pages?: IBuildPageConfig[];
    /** 前端框架，由构建插件写入（plugin-react / plugin-vue） */
    framework?: IBuildFramework;
    /**
     * 类库打包模式（rollup / rolldown 专用）
     * - true：启用多格式输出（cjs/esm/umd），仅监听构建，不启动 dev server
     * - false / 未设置：应用模式，开发时启动 dev server + livereload
     */
    library?: boolean;
    /** 类库全局导出名称（UMD/IIFE 格式必填，如 "MyLib"） */
    libraryName?: string;
    /**
     * SSR（服务端渲染）配置。
     * 启用后，service 会串行执行 client + server 两次 build；env='server' 时 transformConfig 会得到 server bundle 的视图。
     * 与 `target: 'node'` 和 `pages[]` 互斥。
     */
    ssr?: ISSRConfig;
}

export interface IBuildConfig {
    // 构建环境处理
    mode: IBuildEnv;
    /** 构建工具 */
    bundler: IBuildTools;
    /** 插件列表 */
    plugins?: string[];
    /** 构建工具覆盖配置函数 */
    changeConfigure: (
        config: Record<string, unknown>,
        mode: IBuildEnv,
    ) => Promise<Record<string, unknown>> | Record<string, unknown>;

    /**
     * 按 bundler 分块的逃生舱钩子。在 transformConfig 之后、changeConfigure 之前调用。
     * 当 bundler 包未安装时，对应字段的类型会回退到 unknown / any，且运行时永远不会被调用。
     *
     * @example
     * tools: {
     *   webpack(config, { mode }) {
     *     if (mode === 'production') config.devtool = false;
     *   },
     *   vite: (config) => { config.optimizeDeps?.include?.push('lodash-es') }
     * }
     */
    tools?: IToolsHooks;

    /** 构建配置 */
    config: Partial<{
        [K in IBuildEnv]: IEnvBuildConfig;
    }>;
};

/** 基础终端配置 */
export interface ITerminalBaseConfig {
    /** 构建环境 */
    mode: IBuildEnv;
    /** 配置文件路径 */
    config: string;
    /** 构建工具 */
    bundler: IBuildTools;
    /** 需要跳过的插件列表 */
    skipPlugins: string;
}

/** 开发环境终端配置 */
export interface ITerminalDevConfig extends ITerminalBaseConfig {
    /** 是否自动打开浏览器 */
    open: boolean;
    /** 是否复制URL到剪贴板 */
    copy: boolean;
    /** 是否使用标准输入 */
    stdin: boolean;
    /** 主机地址 */
    host: string;
    /** 端口号 */
    port: number;
    /** 是否启用HTTPS */
    https: boolean;
}

/** 生产环境终端配置 */
export interface ITerminalProdConfig extends ITerminalBaseConfig {
    /** 输出目录 */
    dest: string;
    /** 是否不清除输出目录 */
    noClean: boolean;
}