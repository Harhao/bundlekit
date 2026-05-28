#!/usr/bin/env node
/**
 * Pre-publish pack verification.
 *
 * 防止 commit 误删 / .npmignore 配错 / files 字段漏写 导致发布出来的包缺关键
 * 资源（典型如 template-react-ts、template-vue3-ts 被删后仍然 publish）。
 *
 * 流程：
 *   1. 对每个 packages/* 包，跑 `npm pack --dry-run --json`，拿到将要发布的文件清单
 *   2. 找该包本地 templates/ 下所有 template-* 子目录（源真值）
 *   3. 校验每个子目录至少有一个文件命中 pack 文件清单
 *   4. 任一包失败：打印缺失项 + exit 1
 *
 * 用法：
 *   node scripts/verify-pack.mjs            # 校验全部 plugin
 *   node scripts/verify-pack.mjs <pkgDir>   # 仅校验指定包
 *
 * 推荐串到 publish 之前：package.json 的 build:all 后面、changeset publish 前面。
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(REPO_ROOT, "packages");

const COLOR = {
    red:    (s) => `\x1b[31m${s}\x1b[0m`,
    green:  (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
    dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

/** 跑 `npm pack --dry-run --json`，返回文件相对路径数组 */
function runNpmPackDryRun(pkgDir) {
    const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
        cwd: pkgDir,
        encoding: "utf-8",
        // npm pack 在某些情况会把 warning 输出到 stderr，json 在 stdout
        env: { ...process.env, npm_config_loglevel: "error" },
    });
    if (result.status !== 0) {
        throw new Error(
            `npm pack --dry-run 失败 (exit ${result.status}):\n${result.stderr || result.stdout}`,
        );
    }
    let parsed;
    try {
        parsed = JSON.parse(result.stdout);
    } catch (err) {
        throw new Error(`无法解析 npm pack JSON 输出：${(err).message}\n原始输出:\n${result.stdout}`);
    }
    // npm pack --json 的输出形如 [{ name, version, files: [{ path, size, mode }, ...] }]
    if (!Array.isArray(parsed) || !parsed[0] || !Array.isArray(parsed[0].files)) {
        throw new Error(`npm pack JSON 输出格式异常:\n${result.stdout}`);
    }
    return parsed[0].files.map((f) => f.path);
}

/** 列出某 package 本地 templates/template-* 子目录名 */
function listLocalTemplateDirs(pkgDir) {
    const templatesRoot = path.join(pkgDir, "templates");
    if (!fs.existsSync(templatesRoot)) return [];
    return fs.readdirSync(templatesRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.startsWith("template-"))
        .map((d) => d.name);
}

/** 单个包校验 */
function verifyPackage(pkgDir) {
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) return null;
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    if (pkg.private) return null;

    const localTemplates = listLocalTemplateDirs(pkgDir);
    if (localTemplates.length === 0) {
        // 该包没有 template，跳过（别的 plugin 类型）
        return { name: pkg.name, skipped: true };
    }

    const packFiles = runNpmPackDryRun(pkgDir);
    const missing = [];
    for (const tplName of localTemplates) {
        const prefix = `templates/${tplName}/`;
        const hit = packFiles.some((p) => p.startsWith(prefix));
        if (!hit) missing.push(tplName);
    }

    return {
        name: pkg.name,
        version: pkg.version,
        localTemplates,
        missing,
        ok: missing.length === 0,
    };
}

function main() {
    const argTarget = process.argv[2];
    let targets;
    if (argTarget) {
        const abs = path.isAbsolute(argTarget) ? argTarget : path.resolve(process.cwd(), argTarget);
        targets = [abs];
    } else {
        targets = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => path.join(PACKAGES_DIR, d.name));
    }

    console.log(COLOR.cyan("verify-pack: 校验各 npm 包将发布的文件中是否包含全部 templates/template-* 目录"));
    console.log("");

    const results = [];
    let hasError = false;
    for (const dir of targets) {
        const rel = path.relative(REPO_ROOT, dir);
        try {
            const r = verifyPackage(dir);
            if (!r) continue;
            if (r.skipped) {
                console.log(`${COLOR.dim("⊘")} ${rel}  ${COLOR.dim("(no templates/, skip)")}`);
                continue;
            }
            results.push({ rel, ...r });
            if (r.ok) {
                console.log(`${COLOR.green("✓")} ${rel}  ${COLOR.dim(`${r.name}@${r.version}`)}  templates: ${r.localTemplates.join(", ")}`);
            } else {
                hasError = true;
                console.log(`${COLOR.red("✗")} ${rel}  ${COLOR.dim(`${r.name}@${r.version}`)}`);
                console.log(`  ${COLOR.red("缺失模板目录:")} ${r.missing.join(", ")}`);
                console.log(`  ${COLOR.yellow("提示:")} 检查 package.json 的 \"files\" 字段是否包含 \"templates\"，并确认这些目录已 git add 进仓库。`);
            }
        } catch (err) {
            hasError = true;
            console.log(`${COLOR.red("✗")} ${rel}  ${COLOR.red("校验异常:")} ${(err).message}`);
        }
    }

    console.log("");
    if (hasError) {
        console.log(COLOR.red("verify-pack 失败，发布前必须修复以上问题。"));
        process.exit(1);
    } else {
        console.log(COLOR.green(`verify-pack 通过 (${results.length} 个含模板的包)`));
    }
}

main();
