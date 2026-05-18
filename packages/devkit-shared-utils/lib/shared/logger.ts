import readline from "readline";
import chalk from "chalk";
import stripAnsi from "strip-ansi";

import { Spinner } from "./spinner";
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
        if (tag) {
            console.log(this.format(this.chalkTag(tag), msg));
        } else {
            console.log(msg);
        }
    }
    public info(msg: string = "", tag = null) {
        this.log(this.format(chalk.bgBlue.black(" INFO ") + (tag ? this.chalkTag(tag) : ""), msg));
    }

    public error(msg: string | Error, tag = null) {
        this.spinner?.stopSpinner?.(null);
        console.error(
            this.format(chalk.bgRed(" ERROR ") + (tag? this.chalkTag(tag) : ""), chalk.red(msg))
        );
        if (msg instanceof Error) {
            console.error(msg.stack);
        }
    }

    public warn(msg: string = "", tag = null) {
        this.log(this.format(chalk.bgYellow.black(" WARN ") + (tag? this.chalkTag(tag) : ""), chalk.yellow(msg)));
    }

    public done(msg: string = "", tag = null) {
        this?.spinner?.stopSpinner?.(null);
        console.log(this.format(chalk.bgGreen.black(" DONE ") + (tag? this.chalkTag(tag) : ""), chalk.green(msg)));
    }  


    public clearConsole(title: string) {
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