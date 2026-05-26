import type { IBuildConfig, IBuildTools, IToolsCtx } from "@bundlekit/shared-utils";

/**
 * 在 transformConfig 完成后、changeConfigure 之前调用 tools[bundler]?(config, ctx)
 *
 * 返回值约定：
 *   - hook 返回 undefined / void → 用 mutate 后的 rawConfig
 *   - hook 返回新对象           → 用新对象替换
 *
 * hook 抛错 / Promise reject 时不吞掉，由调用方上层 try/catch 处理。
 *
 * 【低11】第一个参数改为只接收 tools 字段，避免传入整个 buildConfig
 */
export async function applyTools(
    tools: IBuildConfig["tools"] | undefined | null,
    bundlerName: IBuildTools,
    rawConfig: unknown,
    ctx: IToolsCtx,
): Promise<unknown> {
    if (!tools) return rawConfig;

    const hook = (tools as Record<string, any>)[bundlerName];
    if (typeof hook !== "function") return rawConfig;

    const result = await hook(rawConfig, ctx);
    return result === undefined ? rawConfig : result;
}
