import React from "react";
import { Box, Text } from "ink";

interface IStepFrameProps {
    title: string;
    step?: number;
    total?: number;
    children: React.ReactNode;
}

export const StepFrame: React.FC<IStepFrameProps> = ({ title, step, total, children }) => {
    const header = step && total ? `Step ${step}/${total} · ${title}` : title;
    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">{header}</Text>
            </Box>
            {children}
        </Box>
    );
};
