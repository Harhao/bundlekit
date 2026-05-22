import React from "react";
import { Command } from "commander";
import Enquirer from "enquirer";
import { render } from "ink";
import { Creator } from "./lib/commands/create/creator";
import { AddCommand } from "./lib/commands/add";
import { App } from "./lib/ui/App";
import { detectAvailablePMs, PMName } from "./lib/commands/create/actions";

const program = new Command();

const TEMPLATES = [
    { name: "react-ts", message: "React + TypeScript" },
    { name: "react-js", message: "React + JavaScript" },
    { name: "vue3-ts", message: "Vue 3 + TypeScript" },
    { name: "vue3-js", message: "Vue 3 + JavaScript" },
];

const BUNDLERS = [
    { name: "vite", message: "Vite" },
    { name: "webpack", message: "Webpack" },
    { name: "rspack", message: "Rspack" },
    { name: "rollup", message: "Rollup" },
    { name: "rolldown", message: "Rolldown" },
];

function isInkEnabled(): boolean {
    if (process.env.DEVKIT_NO_INK === "1") return false;
    if (!process.stdout.isTTY) return false;
    if (!process.stdin.isTTY) return false;
    return true;
}

function readEnvPM(): PMName | undefined {
    const v = process.env.DEVKIT_PM;
    if (v === "pnpm" || v === "yarn" || v === "npm") return v;
    return undefined;
}

function isValidPM(s: unknown): s is PMName {
    return s === "pnpm" || s === "yarn" || s === "npm";
}

async function legacyCreate(name: string, options: Record<string, any>) {
    const enquirer = new Enquirer();

    if (!options.template) {
        const answer = (await enquirer.prompt({
            type: "select",
            name: "template",
            message: "请选择项目模板:",
            choices: TEMPLATES,
        })) as { template: string };
        options.template = answer.template;
    }

    if (!options.bundler) {
        const answer = (await enquirer.prompt({
            type: "select",
            name: "bundler",
            message: "请选择默认构建工具:",
            choices: BUNDLERS,
        })) as { bundler: string };
        options.bundler = answer.bundler;
    }

    // PM 选择：优先级 --pm > DEVKIT_PM > 交互
    let pm: PMName | undefined = isValidPM(options.pm) ? options.pm : undefined;
    if (!pm) pm = readEnvPM();
    if (!pm) {
        const available = detectAvailablePMs();
        const choices = (["pnpm", "yarn", "npm"] as PMName[])
            .filter((n) => available[n])
            .map((n) => ({ name: n, message: n }));
        if (choices.length === 0) {
            // 极端情况：全部不可用，回退 npm
            pm = "npm";
        } else if (choices.length === 1) {
            pm = choices[0].name as PMName;
        } else {
            const answer = (await enquirer.prompt({
                type: "select",
                name: "pm",
                message: "请选择包管理器:",
                choices,
            })) as { pm: string };
            pm = answer.pm as PMName;
        }
    }
    options.pm = pm;

    const creator = new Creator();
    await creator.create(name, options);
}

program
    .command("create <name>")
    .description("create a new project powered by bundlekit-service")
    .option("-t, --template <template>", "模板类型 (react-ts, react-js, vue3-ts, vue3-js)")
    .option("-b, --bundler <bundler>", "默认构建工具 (vite, webpack, rspack, rollup, rolldown)")
    .option("-d, --description <desc>", "项目描述")
    .option("--pm <pm>", "包管理器 (pnpm, yarn, npm)")
    .option("--ssr", "启用 SSR：模板生成 entry-client/entry-server + .bundlekitrc.ts 加 ssr 配置块", false)
    .action(async (name: string, options: Record<string, any>) => {
        if (!isInkEnabled()) {
            // Non-TTY / DEVKIT_NO_INK fallback
            await legacyCreate(name, options);
            return;
        }
        // TTY: ink-rendered UI — 静默 Logger，避免与 ink frame 互打
        process.env.DEVKIT_QUIET = "1";
        const inputPM = isValidPM(options.pm) ? (options.pm as PMName) : undefined;
        const { waitUntilExit } = render(
            React.createElement(App, {
                command: "create",
                params: {
                    name,
                    template: options.template,
                    bundler: options.bundler,
                    pm: inputPM,
                    description: options.description,
                    ssr: !!options.ssr,
                },
            } as any),
        );
        await waitUntilExit();
    });

program
    .command("add <plugin>")
    .description("向已有项目添加插件 / bundler 适配器")
    .action(async (plugin: string) => {
        if (!isInkEnabled()) {
            const addCommand = new AddCommand(process.cwd());
            await addCommand.add(plugin);
            return;
        }
        process.env.DEVKIT_QUIET = "1";
        const { waitUntilExit } = render(
            React.createElement(App, {
                command: "add",
                params: { plugin },
            } as any),
        );
        await waitUntilExit();
    });

program
    .command("help")
    .alias("h")
    .description("处理帮助信息 -h")
    .action(() => {
        program.outputHelp();
    });

program
    .command("version")
    .alias("v")
    .description("bundlekit-cli版本 -v")
    .action(() => {
        const pkg = require("../package.json");
        console.log(`bundlekit-cli v${pkg.version}`);
    });

program.parse(process.argv);
