import { addPluginToConfig } from "@devkit/shared-utils";

export default async function generate(context: string): Promise<void> {
    addPluginToConfig(context, "@devkit/plugin-mock");
}
