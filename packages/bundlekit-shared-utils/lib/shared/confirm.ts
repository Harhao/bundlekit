import readline from "node:readline";

export interface IConfirmOptions {
    /** 提示语 */
    message: string;
    /** 用户直接回车时的默认值 */
    default?: boolean;
}

/**
 * yes/no 交互式确认
 *
 * 行为约定：
 * - 当 stdout 不是 TTY，或 process.env.DEVKIT_NO_PROMPT === "1"
 *   视为非交互环境，立即返回 options.default ?? false
 * - 否则用 readline 在终端读取一行输入（不强依赖第三方 prompt 库）
 *   y / yes / Y / YES → true
 *   n / no  / N / NO  → false
 *   空回车            → options.default ?? false
 *   其他              → 重复询问
 */
export async function confirm(options: IConfirmOptions): Promise<boolean> {
    const defaultValue = options.default ?? false;

    const isTTY = !!process.stdout.isTTY && !!process.stdin.isTTY;
    const noPrompt = process.env.DEVKIT_NO_PROMPT === "1";

    if (!isTTY || noPrompt) {
        return defaultValue;
    }

    const suffix = defaultValue ? " (Y/n) " : " (y/N) ";
    const message = options.message.replace(/\s+$/, "") + suffix;

    return new Promise<boolean>((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const ask = () => {
            rl.question(message, (answer) => {
                const normalized = (answer || "").trim().toLowerCase();
                if (normalized === "") {
                    rl.close();
                    resolve(defaultValue);
                    return;
                }
                if (["y", "yes"].includes(normalized)) {
                    rl.close();
                    resolve(true);
                    return;
                }
                if (["n", "no"].includes(normalized)) {
                    rl.close();
                    resolve(false);
                    return;
                }
                ask();
            });
        };

        ask();
    });
}
