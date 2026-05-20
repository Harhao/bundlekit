import { IBuildTools } from "./adapter";
import { IBuildEnv } from "./env";

export type IBuildFramework = "react" | "vue3";

export type IBuildFormat = "esm" | "commonjs" | "umd" | "iife";

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