import { addPluginToConfig } from "@bundlekit/shared-utils";

export default async function generate(context: string): Promise<void> {
    addPluginToConfig(context, "@bundlekit/plugin-mock");
}
