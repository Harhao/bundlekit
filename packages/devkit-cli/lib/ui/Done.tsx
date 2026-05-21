import React from "react";
import { Box, Text } from "ink";

export type PMName = "pnpm" | "yarn" | "npm";

interface IDoneProps {
    name: string;
    bundler: string;
    template?: string;
    pm?: PMName;
}

function pmRunCmd(pm: PMName, script: string): string {
    return pm === "npm" ? `npm run ${script}` : `${pm} ${script}`;
}

export const Done: React.FC<IDoneProps> = ({ name, bundler, template, pm = "pnpm" }) => {
    const devCmd = pmRunCmd(pm, "dev");
    const buildCmd = pmRunCmd(pm, "build");
    return (
        <Box flexDirection="column" marginTop={1}>
            {/* 顶部成功条幅 */}
            <Box>
                <Text color="green" bold>{"  ✔  项目 "}</Text>
                <Text color="cyan" bold>{name}</Text>
                <Text color="green" bold>{" 创建成功"}</Text>
            </Box>

            {/* 信息面板 */}
            <Box
                flexDirection="column"
                marginTop={1}
                borderStyle="round"
                borderColor="green"
                paddingX={1}
            >
                {template && (
                    <Box>
                        <Text dimColor>{"模板      "}</Text>
                        <Text color="cyan">{template}</Text>
                    </Box>
                )}
                <Box>
                    <Text dimColor>{"打包器    "}</Text>
                    <Text color="cyan">{bundler}</Text>
                </Box>
                <Box>
                    <Text dimColor>{"包管理器  "}</Text>
                    <Text color="cyan">{pm}</Text>
                </Box>
                <Box>
                    <Text dimColor>{"位置      "}</Text>
                    <Text color="cyan">{`./${name}`}</Text>
                </Box>
            </Box>

            {/* 下一步指引 */}
            <Box flexDirection="column" marginTop={1}>
                <Text dimColor>下一步：</Text>
                <Box marginLeft={2} marginTop={1} flexDirection="column">
                    <Box>
                        <Text color="gray">{"$ "}</Text>
                        <Text color="cyan">{`cd ${name}`}</Text>
                    </Box>
                    <Box>
                        <Text color="gray">{"$ "}</Text>
                        <Text color="cyan">{devCmd}</Text>
                        <Text dimColor>{`    使用 ${bundler} 启动开发服务`}</Text>
                    </Box>
                    <Box>
                        <Text color="gray">{"$ "}</Text>
                        <Text color="cyan">{buildCmd}</Text>
                        <Text dimColor>{`  生产构建`}</Text>
                    </Box>
                </Box>
            </Box>

            <Box marginTop={1}>
                <Text dimColor>{"提示："}</Text>
                <Text dimColor>
                    {"使用 "}
                    <Text color="cyan">dc add bundler-{"<name>"}</Text>
                    {" 切换打包器，使用 "}
                    <Text color="cyan">dc add {"<plugin>"}</Text>
                    {" 追加插件"}
                </Text>
            </Box>
        </Box>
    );
};
