import type { IPluginAPIClass, IBuildConfig } from "@bundlekit/shared-utils";

/**
 * Node.js / pure TypeScript 插件。
 *
 * 职责：在 apply 阶段给所有 env 打上 framework='node' 标记，
 * 让 bundler adapter 选择正确的编译平台（esbuild target=node / rollup platform=node 等）。
 * 模板统一走 esm + cjs 双产物，适合纯 TS SDK / CLI 工具 / Node 服务端库。
 */
export default {
    defaultModes: {
        "plugin:node": "development" as const,
    },
    apply(api: IPluginAPIClass, options: IBuildConfig) {
        const buildConfig = api.service.getBuildConfig();
        if (!buildConfig) return;

        for (const env of Object.keys(buildConfig.config || {})) {
            buildConfig.config[env].framework = "node";
            // Node 库不需要 devServer，确保配置里不误启
            if (buildConfig.config[env].devServer) {
                buildConfig.config[env].devServer = undefined;
            }
        }

        api.modifyBuildConfig(buildConfig);
    },
};
