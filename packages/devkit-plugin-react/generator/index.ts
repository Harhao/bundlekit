import { addPluginToConfig } from "@devkit/shared-utils";
import type { IGeneratorAPI } from "@devkit/shared-utils";

export default async function generate(context: string, api: IGeneratorAPI): Promise<void> {
    addPluginToConfig(context, "@devkit/plugin-react");

    const { installRequest } = await api.prompt<{ installRequest: boolean }>([
        {
            type: "confirm",
            name: "installRequest",
            message: "是否同时安装 @devkit/request HTTP 客户端？",
            initial: false,
        },
    ]);

    if (installRequest) {
        api.addDependency("@devkit/request", "^1.0.0");
        api.log("@devkit/request 已写入 dependencies，将随依赖安装一起生效");
    }
}
