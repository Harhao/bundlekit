import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { runBuild, IBuildResult } from "./runBuild";

/**
 * 递归收集 dist 目录下匹配 ext 的文件，返回绝对路径数组
 */
async function collectFiles(dir: string, exts: string[]): Promise<string[]> {
    const out: string[] = [];
    async function walk(d: string) {
        try {
            const ents = await fs.readdir(d, { withFileTypes: true });
            for (const e of ents) {
                const p = path.join(d, e.name);
                if (e.isDirectory()) await walk(p);
                else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
            }
        } catch {
            // dir 不存在
        }
    }
    await walk(dir);
    return out;
}

/**
 * 断言 SPA build 产生 .js 客户端文件且包含 SSR_MARKER 字符串
 */
export async function assertSpaBuild(bundler: string): Promise<void> {
    const r = await runBuild(bundler, "spa");
    try {
        if (r.code !== 0) {
            throw new Error(
                `${bundler} spa build failed (code=${r.code}):\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
            );
        }
        const distDir = path.resolve(r.dir, "dist");
        const jsFiles = await collectFiles(distDir, [".js", ".mjs", ".cjs"]);
        if (jsFiles.length === 0) {
            throw new Error(
                `${bundler} spa: no .js found in ${distDir}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
            );
        }
        let combined = "";
        for (const f of jsFiles) combined += await fs.readFile(f, "utf-8");
        if (!combined.includes("__SSR_MARKER__")) {
            throw new Error(
                `${bundler} spa: bundle does not contain __SSR_MARKER__\nfiles: ${jsFiles.join(", ")}`,
            );
        }
    } finally {
        await r.cleanup();
    }
}

/**
 * 断言 Library build 产生 cjs 文件且 require 后导出 add / LIBRARY_MARKER
 */
export async function assertLibraryBuild(bundler: string): Promise<void> {
    const r = await runBuild(bundler, "lib");
    try {
        if (r.code !== 0) {
            throw new Error(
                `${bundler} lib build failed (code=${r.code}):\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
            );
        }
        const distDir = path.resolve(r.dir, "dist");
        const cjsFiles = await collectFiles(distDir, [".cjs", ".js"]);
        if (cjsFiles.length === 0) {
            throw new Error(
                `${bundler} lib: no cjs/js produced in ${distDir}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
            );
        }
        // 找包含 LIBRARY_MARKER 的产物（rollup/rolldown 可能多 entry）
        let found = false;
        let lastError: any;
        for (const f of cjsFiles) {
            const content = await fs.readFile(f, "utf-8");
            if (!content.includes("__DEVKIT_LIB_MARKER__")) continue;
            try {
                const require = createRequire(__filename);
                // 清缓存（每次 require 干净）
                delete require.cache[require.resolve(f)];
                const mod = require(f);
                const lib = mod?.default ?? mod;
                if (typeof lib?.add === "function" && lib.add(2, 3) === 5) {
                    found = true;
                    break;
                }
                if (mod?.add && mod.add(2, 3) === 5) {
                    found = true;
                    break;
                }
            } catch (e) {
                lastError = e;
            }
        }
        if (!found) {
            throw new Error(
                `${bundler} lib: no requireable cjs found that exports add(a,b) → a+b\n` +
                `cjsFiles: ${cjsFiles.join(", ")}\n` +
                `lastError: ${lastError?.message}`,
            );
        }
    } finally {
        await r.cleanup();
    }
}

/**
 * 断言 SSR build 产生 dist/client + dist/server，且 require server bundle 调 render('/') 返回 SSR_MARKER
 */
export async function assertSsrBuild(bundler: string): Promise<void> {
    const r = await runBuild(bundler, "ssr");
    try {
        if (r.code !== 0) {
            throw new Error(
                `${bundler} ssr build failed (code=${r.code}):\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
            );
        }
        // 客户端产物
        const clientDir = path.resolve(r.dir, "dist/client");
        const clientJs = await collectFiles(clientDir, [".js", ".mjs", ".cjs"]);
        if (clientJs.length === 0) {
            throw new Error(`${bundler} ssr: no client .js in ${clientDir}\nstdout: ${r.stdout}`);
        }
        // 服务端产物
        const serverFile = path.resolve(r.dir, "dist/server/server.cjs");
        const serverStat = await fs.stat(serverFile).catch(() => null);
        if (!serverStat) {
            throw new Error(`${bundler} ssr: server bundle not found at ${serverFile}\nstdout: ${r.stdout}`);
        }
        // require + render('/')
        const require = createRequire(__filename);
        delete require.cache[require.resolve(serverFile)];
        const mod = require(serverFile);
        const render = mod?.render ?? mod?.default?.render;
        if (typeof render !== "function") {
            throw new Error(
                `${bundler} ssr: server bundle has no \`render\` export\nkeys: ${Object.keys(mod || {})}`,
            );
        }
        const html = await render("/");
        if (!String(html).includes("__SSR_MARKER__")) {
            throw new Error(
                `${bundler} ssr: render('/') output missing __SSR_MARKER__\noutput: ${String(html).slice(0, 200)}`,
            );
        }
    } finally {
        await r.cleanup();
    }
}
