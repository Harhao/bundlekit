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
 * 断言 UMD library build：
 *   - dist/ 下产出 *.js / *.umd.js 等可被浏览器 <script> 加载的产物
 *   - 产物里能找到 libraryName（通过文本搜索 `MyLib` 验证 UMD 全局变量名挂上了）
 *   - 用 vm 在伪 browser 环境里 eval 产物，验证 `globalThis.MyLib.add(2,3)===5`
 *
 * 这个断言专门验证 webpack/rspack/vite/rollup/rolldown/parcel 的 library 模式
 * 是否真把 libraryName 注入到了 UMD 包装里 —— 仅靠 require 不能验证 UMD 全局名。
 */
export async function assertLibraryUMDBuild(bundler: string): Promise<void> {
    const r = await runBuild(bundler, "lib-umd");
    try {
        if (r.code !== 0) {
            throw new Error(
                `${bundler} lib-umd build failed (code=${r.code}):\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
            );
        }
        const distDir = path.resolve(r.dir, "dist");
        const allJs = await collectFiles(distDir, [".js", ".cjs", ".mjs"]);
        if (allJs.length === 0) {
            throw new Error(`${bundler} lib-umd: no js produced in ${distDir}`);
        }
        // 找 UMD 包装 + 含 libraryName + LIBRARY_MARKER 的产物
        let umdFile: string | null = null;
        let umdContent: string | null = null;
        for (const f of allJs) {
            const c = await fs.readFile(f, "utf-8");
            if (c.includes("MyLib") && c.includes("__DEVKIT_LIB_MARKER__")) {
                umdFile = f;
                umdContent = c;
                break;
            }
        }
        if (!umdFile || !umdContent) {
            throw new Error(
                `${bundler} lib-umd: no UMD-style file containing both \`MyLib\` and \`__DEVKIT_LIB_MARKER__\`\n` +
                `js files: ${allJs.join(", ")}\nstdout: ${r.stdout.slice(-600)}`,
            );
        }
        // 在伪 browser 环境里 eval UMD 产物，验证全局变量挂上了。
        // 关键：不能定义 module / exports，否则 UMD 包装会探测成 CJS 环境，
        // 把导出送到 module.exports 而不是 global.MyLib。
        const vm = await import("node:vm");
        const sandbox: any = {
            console,
            React: { Children: {}, Component: class {}, createElement: () => ({}) },
            ReactDOM: {},
        };
        sandbox.self = sandbox;
        sandbox.window = sandbox;
        sandbox.globalThis = sandbox;
        // require 给 amd-cjs 分支或显式 require 用；UMD 在浏览器环境下不会调到
        sandbox.require = (id: string) => {
            if (id === "react") return sandbox.React;
            if (id === "react-dom") return sandbox.ReactDOM;
            throw new Error(`stub require: ${id} not provided`);
        };
        try {
            vm.createContext(sandbox);
            vm.runInContext(umdContent, sandbox);
        } catch (e: any) {
            throw new Error(
                `${bundler} lib-umd: vm.runInContext failed for ${umdFile}: ${e?.message ?? e}\n` +
                `first 300 chars: ${umdContent.slice(0, 300)}`,
            );
        }
        const lib = sandbox.MyLib;
        if (!lib || typeof lib.add !== "function") {
            throw new Error(
                `${bundler} lib-umd: globalThis.MyLib not bound after eval\n` +
                `sandbox keys: ${Object.keys(sandbox).filter((k) => !["console","require","React","ReactDOM","self","window","globalThis"].includes(k)).join(", ")}\n` +
                `MyLib value: ${JSON.stringify(sandbox.MyLib)}`,
            );
        }
        if (lib.add(2, 3) !== 5) {
            throw new Error(`${bundler} lib-umd: MyLib.add(2,3) !== 5 (got ${lib.add(2, 3)})`);
        }
    } finally {
        await r.cleanup();
    }
}

/**
 * 断言 SSR build 产生 dist/client + dist/server，且：
 *   - dist/client/*.js 存在（client bundle）
 *   - dist/client/index.html 存在且含 <script src=...>（hydration 入口被正确注入；
 *     pages 配置走 bundler 原生 HTML pipeline，未配 pages 时走 Service 兜底 injector）
 *   - dist/server/server.cjs 存在且 require 后导出 `render`
 *   - render('/') 返回的字符串包含 __SSR_MARKER__
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
        // 客户端 HTML（必须含 <script>，否则浏览器拿不到 hydration 入口）
        const clientHtmlPath = path.resolve(clientDir, "index.html");
        const clientHtmlStat = await fs.stat(clientHtmlPath).catch(() => null);
        if (!clientHtmlStat) {
            // 调试用：列出 dist 实际产物
            const allDist = await collectFiles(path.resolve(r.dir, "dist"), [".html", ".js", ".cjs", ".mjs", ".css"]);
            throw new Error(
                `${bundler} ssr: dist/client/index.html missing (bundler 原生 HTML pipeline 没产出 + Service 兜底 injector 也没生效)\n` +
                `dist tree:\n${allDist.join("\n")}\n` +
                `full stdout:\n${r.stdout}\n` +
                `full stderr:\n${r.stderr}`,
            );
        }
        const clientHtml = await fs.readFile(clientHtmlPath, "utf-8");
        if (!/<script\b[^>]*\bsrc\s*=/i.test(clientHtml)) {
            throw new Error(
                `${bundler} ssr: dist/client/index.html missing <script src=...> hydration entry\nhtml: ${clientHtml.slice(0, 600)}`,
            );
        }
        // 服务端产物：不同 bundler 文件名可能不同（webpack/rspack/rollup/rolldown
        // 用 server.cjs；esbuild/parcel 默认按入口名 entry-server.js / .cjs），
        // 这里在 dist/server 下找任何可 require 的 cjs/js 入口。
        const serverDir = path.resolve(r.dir, "dist/server");
        const serverCandidates = await collectFiles(serverDir, [".cjs", ".js", ".mjs"]);
        if (serverCandidates.length === 0) {
            const allDist = await collectFiles(path.resolve(r.dir, "dist"), [".html", ".js", ".cjs", ".mjs"]);
            throw new Error(
                `${bundler} ssr: no server bundle found in ${serverDir}\n` +
                `dist tree:\n${allDist.join("\n")}\n` +
                `full stdout:\n${r.stdout}\n`,
            );
        }
        // require 每一个候选，直到找到含 render 函数的；ESM .mjs 通过 createRequire 不可读，
        // 优先 .cjs/.js
        const require = createRequire(__filename);
        let serverFile: string | null = null;
        let render: any;
        let lastError: any;
        for (const f of serverCandidates) {
            // .mjs 在 cjs createRequire 下无法读，先跳过
            if (f.endsWith(".mjs")) continue;
            try {
                delete require.cache[require.resolve(f)];
                const mod = require(f);
                const r = mod?.render ?? mod?.default?.render;
                if (typeof r === "function") {
                    serverFile = f;
                    render = r;
                    break;
                }
            } catch (e) {
                lastError = e;
            }
        }
        if (!render) {
            throw new Error(
                `${bundler} ssr: no server bundle exports \`render\`\ncandidates: ${serverCandidates.join(", ")}\n` +
                `lastError: ${lastError?.message ?? "(no error)"}`,
            );
        }
        const html = await render("/");
        if (!String(html).includes("__SSR_MARKER__")) {
            throw new Error(
                `${bundler} ssr: render('/') output missing __SSR_MARKER__\nserverFile: ${serverFile}\noutput: ${String(html).slice(0, 200)}`,
            );
        }
    } finally {
        await r.cleanup();
    }
}
