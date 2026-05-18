import { Command } from "commander";
import Enquirer from "enquirer";
import { Creator } from "./lib/commands/create/creator";
import { AddCommand } from "./lib/commands/add";

const program = new Command();

const templates = [
    { name: "react-ts", message: "React + TypeScript" },
    { name: "react-js", message: "React + JavaScript" },
    { name: "vue3-ts", message: "Vue 3 + TypeScript" },
    { name: "vue3-js", message: "Vue 3 + JavaScript" },
];

const bundlers = [
    { name: "vite", message: "Vite" },
    { name: "webpack", message: "Webpack" },
    { name: "rspack", message: "Rspack" },
    { name: "rollup", message: "Rollup" },
    { name: "rolldown", message: "Rolldown" },
];

program
    .command("create <name>")
    .description("create a new project powered by devkit-service")
    .option("-t, --template <template>", "模板类型 (react-ts, react-js, vue3-ts, vue3-js)")
    .option("-b, --bundler <bundler>", "默认构建工具 (vite, webpack, rspack, rollup, rolldown)")
    .option("-d, --description <desc>", "项目描述")
    .action(async (name, options) => {
        const enquirer = new Enquirer();

        if (!options.template) {
            const answer = await enquirer.prompt<{ template: string }>({
                type: "select",
                name: "template",
                message: "请选择项目模板:",
                choices: templates,
            });
            options.template = answer.template;
        }

        if (!options.bundler) {
            const answer = await enquirer.prompt<{ bundler: string }>({
                type: "select",
                name: "bundler",
                message: "请选择默认构建工具:",
                choices: bundlers,
            });
            options.bundler = answer.bundler;
        }

        let creator = new Creator();
        await creator.create(name, options);
    });

program
    .command("add <plugin>")
    .description("向已有项目添加插件（构建插件自动写入 plugins[]，运行时库写入 dependencies）")
    .action(async (plugin) => {
        const addCommand = new AddCommand(process.cwd());
        await addCommand.add(plugin);
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
    .description("devkit-cli版本 -v")
    .action(() => {
        const pkg = require("../package.json");
        console.log(`devkit-cli v${pkg.version}`);
    });

program.parse(process.argv);
