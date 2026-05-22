import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

export type ITaskStatus = "pending" | "running" | "done" | "error";

export interface ITaskItem {
    id: string;
    label: string;
    status: ITaskStatus;
    detail?: string;
}

interface ITaskListProps {
    tasks: ITaskItem[];
}

const STATUS_ICON: Record<ITaskStatus, string> = {
    pending: "○",
    running: "",
    done: "✔",
    error: "✘",
};

const STATUS_COLOR: Record<ITaskStatus, string> = {
    pending: "gray",
    running: "cyan",
    done: "green",
    error: "red",
};

export const TaskList: React.FC<ITaskListProps> = ({ tasks }) => {
    return (
        <Box flexDirection="column">
            {tasks.map((t) => (
                <Box key={t.id}>
                    <Box width={3}>
                        {t.status === "running" ? (
                            <Text color="cyan">
                                <Spinner type="dots" />
                            </Text>
                        ) : (
                            <Text color={STATUS_COLOR[t.status]}>{STATUS_ICON[t.status]}</Text>
                        )}
                    </Box>
                    <Text color={t.status === "pending" ? "gray" : undefined}>{t.label}</Text>
                    {t.detail ? (
                        <Text dimColor>  ({t.detail})</Text>
                    ) : null}
                </Box>
            ))}
        </Box>
    );
};
