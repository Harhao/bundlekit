import readline from "readline";
import chalk from "chalk";
import stripAnsi from "strip-ansi";

import { Spinner } from "./spinner";

/**
 * 检查是否处于静默模式（如 cli ink 渲染期间）
 * 调用方可设 process.env.DEVKIT_QUIET = "1" 让 Logger 的 log/info/warn/done 静默；
 * error 始终保留输出
 */
function isQuiet(): boolean {
    return process.env.DEVKIT_QUIET === "1";
}

export class Logger {

    private spinner: Spinner | null;
    constructor(spinner?: Spinner) {
        this.spinner = spinner || null;
    }

    private format(label: string, msg: string) {
        return msg.split('\n').map((line, i) => {
            return i === 0 ? `${label} ${line}` : line.padStart(stripAnsi(label).length + line.length + 1);
        }).join('\n');
    }

    private chalkTag(msg: string) {
        return chalk.bgBlackBright.white.dim(` ${msg} `);
    }

    public log(msg: string = "", tag = null) {
        if (isQuiet()) return;
        if (tag) {
            console.log(this.format(this.chalkTag(tag), msg));
        } else {
            console.log(msg);
        }
    }
    public info(msg: string = "", tag = null) {
        if (isQuiet()) return;
        console.log(this.format(chalk.bgBlue.black(" INFO ") + (tag ? this.chalkTag(tag) : ""), msg));
    }

    public error(msg: string | Error, tag = null) {
        // error 永不静默
        this.spinner?.stopSpinner?.(null);
        console.error(
            this.format(chalk.bgRed(" ERROR ") + (tag? this.chalkTag(tag) : ""), chalk.red(msg))
        );
        if (msg instanceof Error) {
            console.error(msg.stack);
        }
    }

    public warn(msg: string = "", tag = null) {
        if (isQuiet()) return;
        console.log(this.format(chalk.bgYellow.black(" WARN ") + (tag? this.chalkTag(tag) : ""), chalk.yellow(msg)));
    }

    public done(msg: string = "", tag = null) {
        if (isQuiet()) return;
        this?.spinner?.stopSpinner?.(null);
        console.log(this.format(chalk.bgGreen.black(" DONE ") + (tag? this.chalkTag(tag) : ""), chalk.green(msg)));
    }

    /** 仅在 DEVKIT_DEBUG=1 时输出，用于内部诊断 */
    public debug(msg: string = "", tag?: string | null) {
        if (process.env.DEVKIT_DEBUG !== "1") return;
        console.log(this.format(chalk.bgGray.white(" DEBUG ") + (tag ? this.chalkTag(tag) : ""), chalk.gray(msg)));
    }


    public clearConsole(title: string) {
        if (isQuiet()) return;
        if (process.stdout.isTTY) {
            const blank = '\n'.repeat(process.stdout.rows);
            console.log(blank);
            readline.cursorTo(process.stdout, 0, 0);
            readline.clearScreenDown(process.stdout);
            if (title) {
                console.log(title);
            }
        }
    }
    public printRecord(record: Record<string, string>) {
        if (isQuiet()) return;
        const indent = '    '; // 定义缩进空格，可根据需要调整
        this.log(); // 空行分隔
        // 找到最长的键名长度，用于对齐输出
        const maxKeyLength = Object.keys(record).reduce((max, key) => Math.max(max, key.length), 0);
        for (const [key, value] of Object.entries(record)) {
            // 计算需要填充的空格数
            const padding = ' '.repeat(maxKeyLength - key.length);
            this.log(`${indent}${key}${padding}: ${value}`);
        }
        this.log(); // 空行分隔
    }
}