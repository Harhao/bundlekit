#!/usr/bin/env node
/**
 * Template × Bundler validation matrix.
 *
 * 流程：
 *   1. 对每个 (template, bundler) 组合：
 *      - 通过 CLI 生成项目到 __tests__/integration/.tmp/validate-<template>-<bundler>/
 *      - 把 package.json 里 @bundlekit/* 的 ^x.y.z 改成 link: 路径（指向 monorepo 包）
 *      - 写入空 pnpm-workspace.yaml 防止 pnpm 向上找
 *      - pnpm install --prefer-offline
 *      - pnpm exec bundlekit-service build --mode development
 *   2. 收集每条结果，最后输出 markdown 表格
 *
 * 不带 --ssr：只验证非 SSR 单 pass 客户端构建（matrix 里最关键的路径）。
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const TMP_ROOT = path.join(REPO_ROOT, "__tests__/integration/.tmp");
const CLI_BIN = path.join(REPO_ROOT, "packages/bundlekit-cli/dist/index.mjs");
const PACKAGES_DIR = path.join(REPO_ROOT, "packages");

const TEMPLATES = ["react-ts", "react-js", "vue3-ts", "vue3-js", "node-ts"];
const BUNDLERS = ["vite", "webpack", "rspack", "rollup", "rolldown", "parcel", "esbuild"];

const PER_BUILD_TIMEOUT_MS = 180_000; // 3 min/build

/** monorepo 包名 → packages/ 目录名 */
const MONOREPO_PKGS = {
    "@bundlekit/cli":              "bundlekit-cli",
    "@bundlekit/service":          "bundlekit-service",
    "@bundlekit/shared-utils":     "bundlekit-shared-utils",
    "@bundlekit/plugin-react":     "bundlekit-plugin-react",
    "@bundlekit/plugin-vue":       "bundlekit-plugin-vue",
    "@bundlekit/plugin-node":      "bundlekit-plugin-node",
    "@bundlekit/plugin-mock":      "bundlekit-plugin-mock",
    "@bundlekit/request":          "bundlekit-request",
    "@bundlekit/bundler-vite":     "bundlekit-bundler-vite",
    "@bundlekit/bundler-webpack":  "bundlekit-bundler-webpack",
    "@bundlekit/bundler-rspack":   "bundlekit-bundler-rspack",
    "@bundlekit/bundler-rollup":   "bundlekit-bundler-rollup",
    "@bundlekit/bundler-rolldown": "bundlekit-bundler-rolldown",
    "@bundlekit/bundler-parcel":   "bundlekit-bundler-parcel",
    "@bundlekit/bundler-esbuild":  "bundlekit-bundler-esbuild",
};

/** 把 generated package.json 中所有 @bundlekit/* deps 改成 link: ../../<repo>/packages/<dir> */
async function rewireToLink(projectDir) {
    const pkgPath = path.join(projectDir, "package.json");
    const raw = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);

    const sections = ["dependencies", "devDependencies", "peerDependencies"];
    for (const sec of sections) {
        if (!pkg[sec]) continue;
        for (const name of Object.keys(pkg[sec])) {
            if (name in MONOREPO_PKGS) {
                const dir = MONOREPO_PKGS[name];
                const linkPath = path.relative(projectDir, path.join(PACKAGES_DIR, dir));
                pkg[sec][name] = `link:${linkPath}`;
            }
        }
    }

    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

/** 写隔离 pnpm-workspace.yaml，防止 pnpm 向上找到 monorepo */
async function isolatePnpm(projectDir) {
    await fs.writeFile(
        path.join(projectDir, "pnpm-workspace.yaml"),
        "packages:\n  - '.'\n",
    );
    // 也写 .npmrc 关闭 corepack 严格模式 + 关 frozen lockfile
    await fs.writeFile(
        path.join(projectDir, ".npmrc"),
        "node-linker=hoisted\nshamefully-hoist=true\n",
    );
}

function runCmd(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: opts.timeout ?? PER_BUILD_TIMEOUT_MS,
        env: { ...process.env, CI: "1", DEVKIT_QUIET: "1", ...(opts.env || {}) },
        cwd: opts.cwd,
    });
    return {
        code: r.status ?? -1,
        stdout: r.stdout?.toString() || "",
        stderr: r.stderr?.toString() || "",
        signal: r.signal,
    };
}

function shortError(stderr, stdout) {
    const text = (stderr || stdout || "").trim();
    if (!text) return "(no output)";
    // 截取最后 ~300 字符的关键信息
    const lines = text.split(/\r?\n/);
    // 优先抓含 ERROR / Error 的行
    const errLine = lines.reverse().find((l) => /error/i.test(l) && l.trim().length > 5);
    if (errLine) return errLine.trim().slice(0, 300);
    return text.slice(-300).replace(/\n/g, " ").trim();
}

async function validateOne(template, bundler) {
    const projectName = `validate-${template}-${bundler}`;
    const projectDir = path.join(TMP_ROOT, projectName);

    // 清干净
    await fs.rm(projectDir, { recursive: true, force: true });
    await fs.mkdir(TMP_ROOT, { recursive: true });

    // 1) 生成
    const gen = runCmd(
        "node",
        [CLI_BIN, "create", projectName, "-t", template, "-b", bundler, "--pm", "pnpm"],
        {
            cwd: TMP_ROOT,
            env: { DEVKIT_SKIP_INSTALL: "1", DEVKIT_NO_INK: "1", DEVKIT_NO_PROMPT: "1" },
            timeout: 60_000,
        },
    );
    if (gen.code !== 0) {
        return { template, bundler, stage: "generate", ok: false, msg: shortError(gen.stderr, gen.stdout) };
    }

    // 2) 改写依赖 + 写 pnpm-workspace.yaml
    try {
        await rewireToLink(projectDir);
        await isolatePnpm(projectDir);
    } catch (e) {
        return { template, bundler, stage: "rewire", ok: false, msg: String(e?.message || e) };
    }

    // 3) install
    const inst = runCmd(
        "pnpm",
        ["install", "--prefer-offline", "--no-frozen-lockfile", "--ignore-scripts"],
        { cwd: projectDir, timeout: 180_000 },
    );
    if (inst.code !== 0) {
        return { template, bundler, stage: "install", ok: false, msg: shortError(inst.stderr, inst.stdout) };
    }

    // 4) build --mode production
    //    （模板只有 development 块；7 个 bundler adapter 都有 || development 兜底，
    //     production 模式下 vite 等会真正跑 build() 而非 dev server）
    const built = runCmd(
        "pnpm",
        ["exec", "bundlekit-service", "build", "--mode", "production"],
        { cwd: projectDir, timeout: PER_BUILD_TIMEOUT_MS },
    );
    if (built.code !== 0) {
        return { template, bundler, stage: "build", ok: false, msg: shortError(built.stderr, built.stdout) };
    }

    // 5) 检查 dist 目录有产物
    const distDir = path.join(projectDir, "dist");
    let hasOutput = false;
    try {
        const entries = await fs.readdir(distDir, { withFileTypes: true });
        hasOutput = entries.length > 0;
    } catch {}
    if (!hasOutput) {
        return { template, bundler, stage: "verify", ok: false, msg: "dist/ 不存在或为空" };
    }

    return { template, bundler, stage: "ok", ok: true, msg: "" };
}

function fmtTable(results) {
    const cols = [" ", ...BUNDLERS];
    const rows = TEMPLATES.map((t) => {
        const row = [t];
        for (const b of BUNDLERS) {
            const r = results.find((x) => x.template === t && x.bundler === b);
            row.push(r ? (r.ok ? "✅" : `❌(${r.stage})`) : "?");
        }
        return row;
    });

    const widths = cols.map((_, i) => Math.max(cols[i].length, ...rows.map((r) => (r[i] || "").length)));
    const fmt = (cells) => "| " + cells.map((c, i) => (c || "").padEnd(widths[i])).join(" | ") + " |";
    const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";

    return [fmt(cols), sep, ...rows.map(fmt)].join("\n");
}

async function main() {
    const args = process.argv.slice(2);
    const filter = {
        templates: args.includes("--templates") ? args[args.indexOf("--templates") + 1].split(",") : TEMPLATES,
        bundlers: args.includes("--bundlers") ? args[args.indexOf("--bundlers") + 1].split(",") : BUNDLERS,
    };

    const total = filter.templates.length * filter.bundlers.length;
    console.log(`\n[validate] total combinations: ${total}\n`);

    const results = [];
    let i = 0;
    for (const template of filter.templates) {
        for (const bundler of filter.bundlers) {
            i++;
            const t0 = Date.now();
            process.stdout.write(`[${i}/${total}] ${template} × ${bundler} ... `);
            const r = await validateOne(template, bundler);
            results.push(r);
            const dur = ((Date.now() - t0) / 1000).toFixed(1);
            console.log(`${r.ok ? "✅" : `❌ ${r.stage}: ${r.msg.slice(0, 120)}`} (${dur}s)`);
        }
    }

    console.log("\n## 结果矩阵\n");
    console.log(fmtTable(results));
    console.log("\n## 失败详情\n");
    for (const r of results.filter((x) => !x.ok)) {
        console.log(`### ${r.template} × ${r.bundler} — ${r.stage}\n`);
        console.log("```");
        console.log(r.msg);
        console.log("```\n");
    }

    const failed = results.filter((x) => !x.ok).length;
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(2);
});
