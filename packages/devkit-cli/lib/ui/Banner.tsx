import React from "react";
import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";

export const Banner: React.FC<{ version?: string }> = ({ version = "" }) => {
    return (
        <Box flexDirection="column" marginBottom={1}>
            <Gradient name="atlas">
                <BigText text="DEVKIT" font="tiny" />
            </Gradient>
            <Box marginLeft={1}>
                <Text dimColor>{`bundle-devkit${version ? ` v${version}` : ""} · 多打包器构建工具`}</Text>
            </Box>
        </Box>
    );
};
