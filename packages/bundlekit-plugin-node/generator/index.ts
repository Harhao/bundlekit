import { addPluginToConfig } from "@bundlekit/shared-utils";
import type { IGeneratorAPI } from "@bundlekit/shared-utils";

function shouldSkipPrompt(): boolean {
    if (!process.stdout.isTTY) return true;
    if (process.env.DEVKIT_NO_PROMPT === "1") return true;
    if (process.env.CI === "true" || process.env.CI === "1") return true;
    return false;
}

export default async function generate(context: string, api: IGeneratorAPI): Promise<void> {
    addPluginToConfig(context, "@bundlekit/plugin-node");

    if (shouldSkipPrompt()) return;

    process.stdout.write("\n");
    process.stdout.write("\x1b[36m──── Node.js 插件配置 ────\x1b[0m\n");
}
