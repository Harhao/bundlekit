import { addPluginToConfig } from "@bundlekit/shared-utils";
import type { IGeneratorAPI } from "@bundlekit/shared-utils";

export default async function generate(context: string, api: IGeneratorAPI): Promise<void> {
    addPluginToConfig(context, "@bundlekit/plugin-mock");
}
