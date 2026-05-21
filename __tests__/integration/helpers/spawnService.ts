import { spawn, ChildProcess, SpawnOptions } from "node:child_process";
import { once } from "node:events";

export interface ISpawnServiceOptions {
    /** 工作目录（fixture 临时目录） */
    cwd: string;
    /** 命令参数（如 ['serve', '--bundler', 'vite', '--mode', 'development']） */
    args: string[];
    /** 等待此正则在 stdout/stderr 出现视为 ready；不传则 spawn 后立刻 resolve */
    waitForLog?: RegExp;
    /** 超时（默认 30s） */
    timeout?: number;
    /** 额外 env（合并到 process.env） */
    env?: Record<string, string>;
}

export interface ISpawnedService {
    /** 子进程 */
    child: ChildProcess;
    /** 优雅 kill */
    kill: () => Promise<void>;
    /** 累积的 stdout */
    stdout: () => string;
    /** 累积的 stderr */
    stderr: () => string;
}

/**
 * spawn devkit-service 子进程。等待指定日志后 resolve。
 *
 * 实现使用 monorepo 的 pnpm exec devkit-service ...，cwd 是 fixture 临时目录。
 * pnpm 会通过 fixture 的 package.json deps 解析到 devkit-service。
 */
export async function spawnService(opts: ISpawnServiceOptions): Promise<ISpawnedService> {
    const timeout = opts.timeout ?? 30_000;

    const child = spawn(
        "pnpm",
        ["exec", "devkit-service", ...opts.args],
        {
            cwd: opts.cwd,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
                ...process.env,
                ...opts.env,
                CI: "1",
            },
            shell: false,
        } as SpawnOptions,
    );

    let stdoutBuf = "";
    let stderrBuf = "";
    child.stdout?.on("data", (b) => (stdoutBuf += b.toString()));
    child.stderr?.on("data", (b) => (stderrBuf += b.toString()));

    const handle: ISpawnedService = {
        child,
        kill: async () => {
            if (child.killed || child.exitCode !== null) return;
            child.kill("SIGTERM");
            try {
                await Promise.race([
                    once(child, "close"),
                    new Promise((_, rej) => setTimeout(() => rej(new Error("kill timeout")), 5_000)),
                ]);
            } catch {
                if (!child.killed) child.kill("SIGKILL");
            }
        },
        stdout: () => stdoutBuf,
        stderr: () => stderrBuf,
    };

    if (!opts.waitForLog) return handle;

    return new Promise<ISpawnedService>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(
                new Error(
                    `spawnService waitForLog ${opts.waitForLog} timeout after ${timeout}ms\n` +
                    `STDOUT: ${stdoutBuf}\nSTDERR: ${stderrBuf}`,
                ),
            );
            handle.kill();
        }, timeout);

        const checkLog = (chunk: string) => {
            if (opts.waitForLog!.test(chunk) || opts.waitForLog!.test(stdoutBuf) || opts.waitForLog!.test(stderrBuf)) {
                clearTimeout(timer);
                resolve(handle);
            }
        };
        child.stdout?.on("data", (b) => checkLog(b.toString()));
        child.stderr?.on("data", (b) => checkLog(b.toString()));
        child.on("close", (code) => {
            clearTimeout(timer);
            reject(
                new Error(
                    `service exited before ready: code=${code}\n` +
                    `STDOUT: ${stdoutBuf}\nSTDERR: ${stderrBuf}`,
                ),
            );
        });
    });
}
