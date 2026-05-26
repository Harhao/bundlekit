import path from "path";
import fs from "fs";
import type { IBuildConfig, IBuildEnv, IEnvBuildConfig, ISSRConfig } from "../types";

/**
 * 把 IBuildConfig 转换为 server pass 视图：
 * - 替换 envConfig.entry 为 ssr.entry
 * - 替换 envConfig.output 为 ssr.output（注意 formats 类型转换）
 * - 强制 target='node'
 * - 不修改原对象，返回新对象
 */
export function buildSSRView(buildConfig: IBuildConfig, mode: IBuildEnv): IBuildConfig {
    const envConfig = buildConfig.config?.[mode];
    if (!envConfig?.ssr) {
        throw new Error(`buildSSRView called for mode ${mode} but envConfig.ssr is not set`);
    }
    const ssr = envConfig.ssr;

    const overriddenEnvConfig: IEnvBuildConfig = {
        ...envConfig,
        target: "node",
        entry: ssr.entry,
        output: {
            dir: ssr.output.dir,
            filename: ssr.output.filename,
            formats: ssr.output.formats === "esm" ? "esm" : "commonjs",
        },
        // server pass 不需要 dev server / pages / inject 等 client 关注点
        pages: undefined,
        inject: undefined,
        // js.splitChunks 在 server 上意义不大，关闭
        js: { ...(envConfig.js || {}), splitChunks: false },
    };

    return {
        ...buildConfig,
        config: {
            ...buildConfig.config,
            [mode]: overriddenEnvConfig,
        },
    };
}

/**
 * 解析 ssr.externals
 *
 * - 'auto' → 返回函数：把 node_modules 内的所有包视为 external
 * - 数组   → 直接返回
 * - 不传   → 数组返回 []（保守：不 external 任何东西）
 *
 * 返回值：函数 (id) => boolean | RegExp[] | string[]
 */
export type SSRExternalsResolver =
    | ((id: string) => boolean)
    | (string | RegExp)[];

export function resolveSSRExternals(
    ssrConfig: ISSRConfig | undefined,
    projectRoot: string,
): SSRExternalsResolver {
    if (!ssrConfig?.externals) return [];

    if (Array.isArray(ssrConfig.externals)) {
        return ssrConfig.externals;
    }

    if (ssrConfig.externals === "auto") {
        // 读取项目 package.json 的 dependencies / peerDependencies 作为 external 名单
        const externalNames = new Set<string>();
        try {
            const pkgPath = path.join(projectRoot, "package.json");
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, any>;
                Object.keys(pkg.dependencies || {}).forEach((k) => externalNames.add(k));
                Object.keys(pkg.peerDependencies || {}).forEach((k) => externalNames.add(k));
            }
        } catch {}

        return (id: string): boolean => {
            // node 内置模块永远 external
            if (id.startsWith("node:")) return true;
            // 相对 / 绝对路径不 external
            if (id.startsWith(".") || path.isAbsolute(id)) return false;
            // 在 dependencies 名单中
            if (externalNames.has(id)) return true;
            // scope 包：@foo/bar 时只比较第一段 @foo/xxx 中的根名
            for (const name of externalNames) {
                if (id === name || id.startsWith(name + "/")) return true;
            }
            return false;
        };
    }

    return [];
}

/**
 * webpack / rspack 格式的 SSR externals 包装器
 *
 * webpack externals 函数签名为 ({ request }, callback) 形式，
 * 本函数将 resolveSSRExternals 的通用解析结果适配为该格式。
 */
export function resolveSSRExternalsForWebpack(
    ssrConfig: ISSRConfig | undefined,
    projectRoot: string,
): (ctx: { request?: string }, callback: (err?: any, result?: string) => void) => void {
    const resolver = resolveSSRExternals(ssrConfig, projectRoot);
    return ({ request }: { request?: string }, callback: (err?: any, result?: string) => void) => {
        if (!request) return callback();
        if (Array.isArray(resolver)) {
            for (const pattern of resolver) {
                if (typeof pattern === "string" && (request === pattern || request.startsWith(pattern + "/"))) {
                    return callback(null, "commonjs " + request);
                }
                if (pattern instanceof RegExp && pattern.test(request)) {
                    return callback(null, "commonjs " + request);
                }
            }
            return callback();
        }
        // 函数型 resolver（auto 模式）
        if ((resolver as (id: string) => boolean)(request)) {
            return callback(null, "commonjs " + request);
        }
        return callback();
    };
}
