import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, useApp } from "ink";
import { Logger } from "@bundlekit/shared-utils";
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
    normalizeProjectDeps,
    installDeps,
    runGenerator,
    detectAvailablePMs,
    resolveDepMode,
    checkTemplateBundlerCombo,
} from "../commands/create/actions";

const TEMPLATES: ISelectItem[] = [
    { label: "React + TypeScript", value: "react-ts" },
    { label: "React + JavaScript", value: "react-js" },
    { label: "Vue 3 + TypeScript", value: "vue3-ts" },
    { label: "Vue 3 + JavaScript", value: "vue3-js" },
    { label: "Svelte + TypeScript", value: "svelte-ts" },
    { label: "Svelte + JavaScript", value: "svelte-js" },
    { label: "Angular + TypeScript", value: "angular-ts" },
    { label: "Angular + JavaScript", value: "angular-js" },
    { label: "Node.js / 纯 TypeScript（无框架）", value: "node-ts" },
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
    { label: "Parcel    —— 零配置",           value: "parcel" },
    { label: "esbuild   —— 极速编译",         value: "esbuild" },
    { label: "← 返回",                        value: "__back__" },
];

const PM_ORDER: PMName[] = ["pnpm", "yarn", "npm"];

const PM_LABEL: Record<PMName, string> = {
    pnpm: "pnpm  —— 推荐，磁盘占用最小",
    yarn: "yarn  —— 兼容性好",
    npm:  "npm   —— Node 内置",
};

type Step = "template" | "bundler" | "ssr" | "pm" | "description" | "tasks" | "done" | "error";

export interface ICreateAppParams {
    name: string;
    template?: string;
    bundler?: string;
    pm?: PMName;
    description?: string;
    cwd?: string;
    ssr?: boolean;
    /** 类库 / SDK 模式：跳过 HTML 入口，输出多格式 */
    library?: boolean;
    /** UMD/IIFE 全局变量名（仅 library 模式） */
    libraryName?: string;
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
    const [ssr, setSsr] = useState<boolean | undefined>(params.ssr !== undefined ? params.ssr : undefined);

    const availablePMs = useMemo(() => detectAvailablePMs(), []);
    const envPM = useMemo(() => readEnvPM(), []);
    const [pm, setPm] = useState<PMName | undefined>(
        pickInitialPM(params.pm, envPM, availablePMs),
    );

    // 依赖模式（link / npm）：仅 task 阶段需要展示，提前算好供 Done 视图用
    const detectedDepMode = useMemo(() => resolveDepMode(params.cwd || process.cwd()), [params.cwd]);

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
    } else if (template === "node-ts" ? false : ssr === undefined) {
        currentStep = "ssr";
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

    /**
     * 让出一帧给 Ink 渲染。
     * - React 18 + Ink 的 setState 会被合批到下一个微任务一次性 flush
     * - 中间穿插同步重活（fs/EJS/JSON I/O）会让多次状态变化看起来"批量跳出来"
     * - setTimeout(0) 会跳到宏任务，给 Ink 留出实际把帧 paint 到终端的时间窗口
     */
    const yieldFrame = useCallback(
        () => new Promise<void>((r) => setTimeout(r, 0)),
        [],
    );

    useEffect(() => {
        if (currentStep !== "tasks") return;
        if (tasks.length > 0) return;

        const initialTasks: ITaskItem[] = [
            { id: "render",    label: "渲染模板",                       status: "pending" },
            { id: "normalize", label: "规范化依赖版本",                  status: "pending" },
            { id: "deps",      label: "写入 bundler 到 devDependencies", status: "pending" },
            { id: "install",   label: "安装依赖",                       status: "pending" },
            { id: "generator", label: "调用框架插件 generator",          status: "pending" },
        ];
        setTasks(initialTasks);

        (async () => {
            // 让初始 5 个 pending 标签先完整渲染一帧，再开跑任务
            // 否则 setTasks 会和后续 updateTask("render", running) 合批，用户看不到"全 pending"
            await yieldFrame();
            const cwd = params.cwd || process.cwd();

            // 防御性二道关：模板 × 打包器组合不兼容（如 svelte × parcel）
            // bundler 步骤已在 UI 层灰掉这些选项，此处兜底防止参数注入路径绕过。
            const comboError = checkTemplateBundlerCombo(template!, bundler!);
            if (comboError) {
                setError({ step: "校验组合", message: comboError });
                return;
            }

            let targetDir: string;
            try {
                ({ targetDir } = validateProject(params.name, cwd));
            } catch (err) {
                setError({ step: "校验项目", message: (err as Error).message });
                return;
            }

            const logger = new Logger();
            const depMode = resolveDepMode(cwd);

            try {
                updateTask("render", { status: "running" });
                await yieldFrame();
                const templateDir = resolveTemplateDir(template!);
                await renderTemplates({
                    targetDir,
                    templateDir,
                    projectName: params.name,
                    description,
                    bundler: bundler!,
                    ssr,
                    library: params.library,
                    libraryName: params.libraryName,
                });
                updateTask("render", { status: "done" });
                await yieldFrame();
            } catch (err) {
                const e = err as Error;
                updateTask("render", { status: "error" });
                setError({ step: "渲染模板", message: e.message, stack: e.stack });
                return;
            }

            try {
                updateTask("normalize", { status: "running" });
                await yieldFrame();
                normalizeProjectDeps(targetDir, depMode);
                const detail = `npm 模式 → ^${depMode.cliVersion}`;
                updateTask("normalize", { status: "done", detail });
                await yieldFrame();
            } catch (err) {
                const e = err as Error;
                updateTask("normalize", { status: "error" });
                setError({ step: "规范化依赖版本", message: e.message, stack: e.stack });
                return;
            }

            try {
                updateTask("deps", { status: "running" });
                await yieldFrame();
                const written = injectBundlerToDeps(targetDir, bundler!, depMode);
                if (written) {
                    const [pkgName, version] = written;
                    updateTask("deps", { status: "done", detail: `${pkgName}@${version}` });
                } else {
                    updateTask("deps", { status: "done", detail: "未识别的 bundler，跳过" });
                }
                await yieldFrame();
            } catch (err) {
                const e = err as Error;
                updateTask("deps", { status: "error" });
                setError({ step: "写入 devDependencies", message: e.message, stack: e.stack });
                return;
            }

            try {
                updateTask("install", { status: "running" });
                await yieldFrame();
                await installDeps(targetDir, { pm });
                updateTask("install", { status: "done" });
                await yieldFrame();
            } catch (err) {
                const e = err as Error;
                updateTask("install", { status: "error" });
                setError({ step: "安装依赖", message: e.message, stack: e.stack });
                return;
            }

            try {
                updateTask("generator", { status: "running" });
                await yieldFrame();
                const pluginPkgName = resolvePluginPkgName(template!);
                // ink 路径下 generator 不应另起 enquirer prompt 抢 stdin
                const prevNoPrompt = process.env.DEVKIT_NO_PROMPT;
                process.env.DEVKIT_NO_PROMPT = "1";
                let hasPendingDeps = false;
                try {
                    hasPendingDeps = await runGenerator(pluginPkgName, targetDir, logger);
                } finally {
                    if (prevNoPrompt === undefined) {
                        delete process.env.DEVKIT_NO_PROMPT;
                    } else {
                        process.env.DEVKIT_NO_PROMPT = prevNoPrompt;
                    }
                }
                if (hasPendingDeps) {
                    // generator 可能追加了 workspace:^ 依赖，再 normalize 一次
                    normalizeProjectDeps(targetDir, depMode);
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
    }, [currentStep, tasks.length, template, bundler, pm, ssr, description, params, updateTask, yieldFrame]);

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
                <StepFrame title="模板" step={1} total={5}>
                    <Select
                        items={TEMPLATES}
                        initialValue={template}
                        onSelect={(v) => setTemplate(v)}
                    />
                </StepFrame>
            )}

            {currentStep === "bundler" && (
                <StepFrame title="打包器" step={2} total={5}>
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
                            items={BUNDLERS_SECONDARY.map((item) => {
                                // 已选模板与打包器组合不兼容时（如 svelte × parcel）
                                // 在 Select 列表里灰掉该项并提示原因
                                if (typeof item.value !== "string" || !template) return item;
                                if (item.value === "__back__") return item;
                                const incompat = checkTemplateBundlerCombo(template, item.value);
                                if (!incompat) return item;
                                return {
                                    ...item,
                                    disabled: true,
                                    disabledReason: "(暂不兼容当前模板)",
                                };
                            })}
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

            {currentStep === "ssr" && (
                <StepFrame title="SSR" step={3} total={5}>
                    <Box marginBottom={1}>
                        <Text dimColor>已选打包器：</Text>
                        <Text color="cyan"> {bundler}</Text>
                    </Box>
                    <Select
                        items={[
                            { label: "否 — 纯客户端渲染（推荐）", value: "no" },
                            { label: "是 — 启用 SSR（需要服务端渲染）", value: "yes" },
                        ]}
                        onSelect={(v) => setSsr(v === "yes")}
                    />
                </StepFrame>
            )}

            {currentStep === "pm" && (
                <StepFrame title="包管理器" step={4} total={5}>
                    <Box marginBottom={1}>
                        <Text dimColor>用于安装项目依赖：</Text>
                    </Box>
                    <Select<PMName> items={pmItems} onSelect={(v) => setPm(v)} />
                </StepFrame>
            )}

            {currentStep === "description" && (
                <StepFrame title="项目描述（可选，按回车跳过）" step={5} total={5}>
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
                        <Text dimColor>{`  ${template} · ${bundler} · ${ssr ? "SSR" : "CSR"} · ${pm}`}</Text>
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
