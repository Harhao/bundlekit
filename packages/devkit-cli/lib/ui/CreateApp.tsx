import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, useApp } from "ink";
import { Logger } from "@devkit/shared-utils";
import { Banner } from "./Banner";
import { StepFrame } from "./StepFrame";
import { Select, ISelectItem } from "./Select";
import { TextInput } from "./TextInput";
import { TaskList, ITaskItem } from "./TaskList";
import { Done, PMName } from "./Done";
import { ErrorView } from "./ErrorView";
import {
    validateProject,
    resolveTemplateDir,
    resolvePluginPkgName,
    renderTemplates,
    injectBundlerToDeps,
    installDeps,
    runGenerator,
    detectAvailablePMs,
} from "../commands/create/actions";

const TEMPLATES: ISelectItem[] = [
    { label: "React + TypeScript", value: "react-ts" },
    { label: "React + JavaScript", value: "react-js" },
    { label: "Vue 3 + TypeScript", value: "vue3-ts" },
    { label: "Vue 3 + JavaScript", value: "vue3-js" },
];

const BUNDLERS_PRIMARY: ISelectItem[] = [
    { label: "Vite      —— 开发体感最佳",     value: "vite" },
    { label: "Webpack   —— 生态最完整",       value: "webpack" },
    { label: "Rspack    —— Rust 实现，极速",  value: "rspack" },
    { label: "更多打包器 →",                  value: "__more__" },
];

const BUNDLERS_SECONDARY: ISelectItem[] = [
    { label: "Rollup    —— 适合库构建",       value: "rollup" },
    { label: "Rolldown  —— 实验性",           value: "rolldown" },
    { label: "← 返回",                        value: "__back__" },
];

const PM_ORDER: PMName[] = ["pnpm", "yarn", "npm"];

const PM_LABEL: Record<PMName, string> = {
    pnpm: "pnpm  —— 推荐，磁盘占用最小",
    yarn: "yarn  —— 兼容性好",
    npm:  "npm   —— Node 内置",
};

type Step = "template" | "bundler" | "pm" | "description" | "tasks" | "done" | "error";

export interface ICreateAppParams {
    name: string;
    template?: string;
    bundler?: string;
    pm?: PMName;
    description?: string;
    cwd?: string;
    ssr?: boolean;
}

interface IErrorState {
    step: string;
    message: string;
    stack?: string;
}

function readEnvPM(): PMName | undefined {
    const v = process.env.DEVKIT_PM;
    if (v === "pnpm" || v === "yarn" || v === "npm") return v;
    return undefined;
}

function pickInitialPM(
    explicit: PMName | undefined,
    envPM: PMName | undefined,
    available: Record<PMName, boolean>,
): PMName | undefined {
    if (explicit && available[explicit]) return explicit;
    if (envPM && available[envPM]) return envPM;
    return undefined;
}

export const CreateApp: React.FC<{ params: ICreateAppParams }> = ({ params }) => {
    const { exit } = useApp();
    const [template, setTemplate] = useState<string | undefined>(params.template);
    const [bundler, setBundler] = useState<string | undefined>(params.bundler);
    const [bundlerLevel, setBundlerLevel] = useState<"primary" | "secondary">("primary");

    const availablePMs = useMemo(() => detectAvailablePMs(), []);
    const envPM = useMemo(() => readEnvPM(), []);
    const [pm, setPm] = useState<PMName | undefined>(
        pickInitialPM(params.pm, envPM, availablePMs),
    );

    const [description, setDescription] = useState<string>(params.description || "");
    const [descriptionSubmitted, setDescriptionSubmitted] = useState<boolean>(
        params.description !== undefined,
    );
    const [tasks, setTasks] = useState<ITaskItem[]>([]);
    const [error, setError] = useState<IErrorState | null>(null);

    let currentStep: Step;
    if (error) {
        currentStep = "error";
    } else if (tasks.length > 0 && tasks.every((t) => t.status === "done")) {
        currentStep = "done";
    } else if (tasks.length > 0) {
        currentStep = "tasks";
    } else if (!template) {
        currentStep = "template";
    } else if (!bundler) {
        currentStep = "bundler";
    } else if (!pm) {
        currentStep = "pm";
    } else if (!descriptionSubmitted) {
        currentStep = "description";
    } else {
        currentStep = "tasks";
    }

    const updateTask = useCallback((id: string, patch: Partial<ITaskItem>) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    }, []);

    useEffect(() => {
        if (currentStep !== "tasks") return;
        if (tasks.length > 0) return;

        const initialTasks: ITaskItem[] = [
            { id: "render",    label: "渲染模板",                       status: "pending" },
            { id: "deps",      label: "写入 bundler 到 devDependencies", status: "pending" },
            { id: "install",   label: "安装依赖",                       status: "pending" },
            { id: "generator", label: "调用框架插件 generator",          status: "pending" },
        ];
        setTasks(initialTasks);

        (async () => {
            const cwd = params.cwd || process.cwd();
            let targetDir: string;
            try {
                ({ targetDir } = validateProject(params.name, cwd));
            } catch (err) {
                setError({ step: "校验项目", message: (err as Error).message });
                return;
            }

            const logger = new Logger();

            try {
                updateTask("render", { status: "running" });
                const templateDir = resolveTemplateDir(template!);
                await renderTemplates({
                    targetDir,
                    templateDir,
                    projectName: params.name,
                    description,
                    bundler: bundler!,
                    ssr: !!params.ssr,
                });
                updateTask("render", { status: "done" });
            } catch (err) {
                const e = err as Error;
                updateTask("render", { status: "error" });
                setError({ step: "渲染模板", message: e.message, stack: e.stack });
                return;
            }

            try {
                updateTask("deps", { status: "running" });
                const written = injectBundlerToDeps(targetDir, bundler!);
                if (written) {
                    const [pkgName, version] = written;
                    updateTask("deps", { status: "done", detail: `${pkgName}@${version}` });
                } else {
                    updateTask("deps", { status: "done", detail: "未识别的 bundler，跳过" });
                }
            } catch (err) {
                const e = err as Error;
                updateTask("deps", { status: "error" });
                setError({ step: "写入 devDependencies", message: e.message, stack: e.stack });
                return;
            }

            try {
                updateTask("install", { status: "running" });
                await installDeps(targetDir, { pm });
                updateTask("install", { status: "done" });
            } catch (err) {
                const e = err as Error;
                updateTask("install", { status: "error" });
                setError({ step: "安装依赖", message: e.message, stack: e.stack });
                return;
            }

            try {
                updateTask("generator", { status: "running" });
                const pluginPkgName = resolvePluginPkgName(template!);
                const hasPendingDeps = await runGenerator(pluginPkgName, targetDir, logger);
                if (hasPendingDeps) {
                    await installDeps(targetDir, { pm });
                }
                updateTask("generator", { status: "done" });
            } catch (err) {
                const e = err as Error;
                updateTask("generator", { status: "error" });
                setError({ step: "调用 generator", message: e.message, stack: e.stack });
                return;
            }
        })();
    }, [currentStep, tasks.length, template, bundler, pm, description, params, updateTask]);

    useEffect(() => {
        if (currentStep === "done") {
            const t = setTimeout(() => exit(), 100);
            return () => clearTimeout(t);
        }
        if (currentStep === "error") {
            const t = setTimeout(() => {
                exit();
                process.exit(1);
            }, 100);
            return () => clearTimeout(t);
        }
        return undefined;
    }, [currentStep, exit]);

    const pmItems: ISelectItem<PMName>[] = useMemo(
        () =>
            PM_ORDER.map((name) => ({
                label: PM_LABEL[name],
                value: name,
                disabled: !availablePMs[name],
                disabledReason: !availablePMs[name] ? "(未安装)" : undefined,
            })),
        [availablePMs],
    );

    return (
        <Box flexDirection="column">
            <Banner />

            {currentStep === "template" && (
                <StepFrame title="模板" step={1} total={4}>
                    <Select
                        items={TEMPLATES}
                        initialValue={template}
                        onSelect={(v) => setTemplate(v)}
                    />
                </StepFrame>
            )}

            {currentStep === "bundler" && (
                <StepFrame title="打包器" step={2} total={4}>
                    <Box marginBottom={1}>
                        <Text dimColor>已选模板：</Text>
                        <Text color="cyan"> {template}</Text>
                    </Box>
                    {bundlerLevel === "primary" ? (
                        <Select
                            items={BUNDLERS_PRIMARY}
                            initialValue={bundler}
                            onSelect={(v) => {
                                if (v === "__more__") {
                                    setBundlerLevel("secondary");
                                } else {
                                    setBundler(v);
                                }
                            }}
                        />
                    ) : (
                        <Select
                            items={BUNDLERS_SECONDARY}
                            onSelect={(v) => {
                                if (v === "__back__") {
                                    setBundlerLevel("primary");
                                } else {
                                    setBundler(v);
                                }
                            }}
                            onBack={() => setBundlerLevel("primary")}
                        />
                    )}
                </StepFrame>
            )}

            {currentStep === "pm" && (
                <StepFrame title="包管理器" step={3} total={4}>
                    <Box marginBottom={1}>
                        <Text dimColor>用于安装项目依赖：</Text>
                    </Box>
                    <Select<PMName> items={pmItems} onSelect={(v) => setPm(v)} />
                </StepFrame>
            )}

            {currentStep === "description" && (
                <StepFrame title="项目描述（可选，按回车跳过）" step={4} total={4}>
                    <TextInput
                        value={description}
                        placeholder="A demo app"
                        onChange={setDescription}
                        onSubmit={(v) => {
                            setDescription(v || " ");
                            setDescriptionSubmitted(true);
                        }}
                    />
                </StepFrame>
            )}

            {(currentStep === "tasks" || currentStep === "done") && (
                <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
                    <Box marginBottom={1}>
                        <Text bold color="cyan">{"创建项目 "}</Text>
                        <Text bold>{params.name}</Text>
                        <Text dimColor>{`  ${template} · ${bundler} · ${pm}`}</Text>
                    </Box>
                    <TaskList tasks={tasks} />
                </Box>
            )}

            {currentStep === "done" && (
                <Done name={params.name} bundler={bundler!} template={template} pm={pm} />
            )}

            {currentStep === "error" && error && (
                <ErrorView step={error.step} message={error.message} stack={error.stack} />
            )}
        </Box>
    );
};
