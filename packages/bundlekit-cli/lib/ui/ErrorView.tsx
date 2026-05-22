import React from "react";
import { Box, Text } from "ink";

interface IErrorViewProps {
    step: string;
    message: string;
    stack?: string;
}

export const ErrorView: React.FC<IErrorViewProps> = ({ step, message, stack }) => {
    return (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="red" paddingX={1}>
            <Box>
                <Text color="red" bold>✘ {step} 失败</Text>
            </Box>
            <Box marginTop={1}>
                <Text color="redBright">{message}</Text>
            </Box>
            {stack ? (
                <Box marginTop={1}>
                    <Text dimColor>{stack}</Text>
                </Box>
            ) : null}
        </Box>
    );
};
