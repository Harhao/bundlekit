import type { IPluginAPIClass, IBuildConfig } from "@devkit/shared-utils";

export default {
    defaultModes: {
        "plugin:mock": "development" as const,
    },
    apply(api: IPluginAPIClass, options: IBuildConfig) {
        api.registerCommand("plugin:mock", {
            description: "启动 mock API 服务并注入代理配置",
            usage: "devkit plugin:mock",
            options: {
                "--port": "mock 服务端口 (默认: 4000)",
            },
        }, async (args) => {
            const port = Number(args.port) || 4000;
            const buildConfig = api.service.getBuildConfig();
            if (!buildConfig) return;

            const envValues = buildConfig.config || {};
            for (const env of Object.keys(envValues)) {
                const envConfig = envValues[env] || {};
                envConfig.devServer = {
                    ...(envConfig.devServer || {}),
                    proxy: {
                        "/api": {
                            target: `http://localhost:${port}`,
                            changeOrigin: true,
                            secure: false,
                        },
                    },
                };
            }

            api.service.setBuildConfig(buildConfig);

            try {
                const jsonServer = await import("json-server");
                const server = jsonServer.default.create();
                server.use(jsonServer.default.defaults());
                server.use(jsonServer.default.router({}));
                server.listen(port, () => {
                    api.service.logger.done(`Mock API 服务已启动: http://localhost:${port}`);
                });
            } catch (e) {
                api.service.logger.error(`Mock 服务启动失败: ${e}`);
            }
        });
    },
};
