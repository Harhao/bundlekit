import type { IPluginAPIClass, IBuildConfig } from "@bundlekit/shared-utils";

export default {
    defaultModes: {
        "plugin:vue": "development" as const,
    },
    apply(api: IPluginAPIClass, options: IBuildConfig) {
        const buildConfig = api.service.getBuildConfig();
        if (!buildConfig) return;

        for (const env of Object.keys(buildConfig.config || {})) {
            buildConfig.config[env].framework = "vue3";
        }

        api.modifyBuildConfig(buildConfig);
    },
};
