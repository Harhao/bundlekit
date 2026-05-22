import { addPluginToConfig } from "@bundlekit/shared-utils";
import type { IGeneratorAPI } from "@bundlekit/shared-utils";

/**
 * 在 cli create 流程（ink）/ CI / 非 TTY 场景下默认跳过交互式 prompt。
 *
 * 仅当用户在真 TTY 下手动调 `dc add vue` 时才会弹 prompt。
 */
function shouldSkipPrompt(): boolean {
    if (!process.stdout.isTTY) return true;
    if (process.env.DEVKIT_NO_PROMPT === "1") return true;
    if (process.env.CI === "true" || process.env.CI === "1") return true;
    return false;
}

export default async function generate(context: string, api: IGeneratorAPI): Promise<void> {
    addPluginToConfig(context, "@bundlekit/plugin-vue");

    if (shouldSkipPrompt()) {
        return;
    }

    process.stdout.write("\n");
    process.stdout.write("\x1b[36m──── 框架插件配置 ────\x1b[0m\n");

    const { installRequest } = await api.prompt<{ installRequest: boolean }>([
        {
            type: "confirm",
            name: "installRequest",
            message: "是否同时安装 @bundlekit/request HTTP 客户端？",
            initial: false,
        },
    ]);

    if (installRequest) {
        api.addDependency("@bundlekit/request", "workspace:^");
        api.log("@bundlekit/request 已写入 dependencies，将随依赖安装一起生效");
    }
}
