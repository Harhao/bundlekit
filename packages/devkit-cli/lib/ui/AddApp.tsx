import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { Logger } from "@devkit/shared-utils";
import { Banner } from "./Banner";
import { TaskList, ITaskItem } from "./TaskList";
import { ErrorView } from "./ErrorView";
import { AddCommand } from "../commands/add";

interface IAddAppParams {
    plugin: string;
    cwd?: string;
}

interface IErrorState {
    step: string;
    message: string;
    stack?: string;
}

export const AddApp: React.FC<{ params: IAddAppParams }> = ({ params }) => {
    const { exit } = useApp();
    const [tasks, setTasks] = useState<ITaskItem[]>([
        { id: "resolve", label: `解析 ${params.plugin}`, status: "pending" },
        { id: "install", label: "安装依赖",              status: "pending" },
        { id: "generator", label: "调用 generator (如有)", status: "pending" },
    ]);
    const [error, setError] = useState<IErrorState | null>(null);

    useEffect(() => {
        const update = (id: string, patch: Partial<ITaskItem>) => {
            setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
        };

        (async () => {
            try {
                update("resolve", { status: "running" });
                const cwd = params.cwd || process.cwd();
                const cmd = new AddCommand(cwd);
                update("resolve", { status: "done" });

                update("install", { status: "running" });
                await cmd.add(params.plugin);
                // AddCommand 内部已经处理 install + generator
                update("install", { status: "done" });
                update("generator", { status: "done" });
            } catch (err) {
                const e = err as Error;
                setError({ step: "add", message: e.message, stack: e.stack });
            } finally {
                setTimeout(() => exit(), 100);
            }
        })();
    }, [params, exit]);

    return (
        <Box flexDirection="column">
            <Banner />
            <Box marginBottom={1}>
                <Text>追加：</Text>
                <Text color="cyan" bold> {params.plugin}</Text>
            </Box>
            <TaskList tasks={tasks} />
            {error && <ErrorView step={error.step} message={error.message} stack={error.stack} />}
        </Box>
    );
};
