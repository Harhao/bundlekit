/**
 * SSR 模板编译工具
 *
 * 背景：
 *   SSR build 双 pass 流程下，client pass 产物（hashed *.js / *.css）位于 dist/。
 *   server pass 用 `ssr.template` 字段指向的 HTML 来在请求时替换 <!--ssr-outlet-->。
 *   但 client bundle 必须以 <script> 标签的形式插到 HTML 中，浏览器才会下载并执行
 *   hydration —— 这一步既不在 client 编译产物里，也不在 server runtime 里，必须在
 *   client pass 完成后由 service 显式做一遍 HTML 注入。
 *
 * 用法：service 在 client pass 后调本函数，扫描 outDir 下顶层 *.js / *.css 产物，
 *      把 <link>/<script> 注入到 sourceTemplate，写到 destPath（默认 dist/index.html）。
 *      生产 SSR 部署时，server 端读这个被编译后的 HTML 作为模板。
 */
import fs from "node:fs";
import path from "node:path";

export interface IBuildSSRHTMLTemplateOptions {
    /** 源 HTML 模板的绝对路径（如 public/index.html） */
    sourceTemplate: string;
    /** client 编译产物目录的绝对路径（如 dist/） */
    outDir: string;
    /** 静态资源访问前缀，对应 envConfig.publicPath，默认 "/" */
    publicPath?: string;
    /** 编译后的 HTML 输出绝对路径，默认 path.join(outDir, "index.html") */
    destPath?: string;
    /**
     * 是否在缺失 outDir / 模板时静默跳过（默认 true）。
     * service 在 SSR 流程里调用，如果上一步 client pass 失败需要容错。
     */
    silentOnMissing?: boolean;
}

export interface IBuildSSRHTMLTemplateResult {
    /** 编译后 HTML 的输出路径；跳过时为 null */
    output: string | null;
    /** 注入到模板里的 JS 资源（相对 publicPath 的文件名） */
    jsFiles: string[];
    /** 注入到模板里的 CSS 资源 */
    cssFiles: string[];
}

/**
 * 把 client 编译产物作为 <script> / <link> 注入 sourceTemplate，输出到 destPath。
 *
 * 扫描策略：
 *   - **递归**扫 outDir 下所有 *.js / *.css 产物（包含 vite 的 assets/js/ 这类嵌套目录）
 *   - 排除 *.map、destPath 自身
 *   - 排除 dist/server/ 子目录（避免把 server bundle 误注入到 HTML）
 *   - 文件路径相对 outDir 转换为 URL（用 / 分隔），再以 publicPath 为前缀拼出 src
 *
 * 注入规则：
 *   - CSS：插在 </head> 前；若无 </head> 则不注入
 *   - JS ：插在 </body> 前；若无 </body> 则追加到末尾
 *
 * 跳过规则（silentOnMissing=true 时）：
 *   - sourceTemplate 不存在 / outDir 不存在 / 没扫到 .js → 跳过并返回 { output: null }
 */
export function buildSSRHTMLTemplate(
    opts: IBuildSSRHTMLTemplateOptions,
): IBuildSSRHTMLTemplateResult {
    const {
        sourceTemplate,
        outDir,
        publicPath = "/",
        destPath = path.join(outDir, "index.html"),
        silentOnMissing = true,
    } = opts;

    const empty: IBuildSSRHTMLTemplateResult = { output: null, jsFiles: [], cssFiles: [] };

    if (!fs.existsSync(sourceTemplate)) {
        if (silentOnMissing) return empty;
        throw new Error(`SSR template not found: ${sourceTemplate}`);
    }
    if (!fs.existsSync(outDir)) {
        if (silentOnMissing) return empty;
        throw new Error(`SSR client outDir not found: ${outDir}`);
    }

    // 递归扫 outDir，把所有相对路径收集起来；排除 .map / index.html / dist/server 子目录
    const jsFiles: string[] = [];
    const cssFiles: string[] = [];
    const destRel = path.relative(outDir, destPath);
    const walk = (dir: string, relPrefix: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
            // 显式排除 server 子目录（避免把 server bundle 注入到 client HTML）
            if (e.isDirectory()) {
                if (e.name === "server") continue;
                walk(path.join(dir, e.name), rel);
                continue;
            }
            if (!e.isFile()) continue;
            const n = e.name;
            if (rel === destRel) continue;                  // 跳过 destPath 自身
            if (n.endsWith(".js.map") || n.endsWith(".css.map")) continue;
            if (n.endsWith(".js") || n.endsWith(".mjs")) jsFiles.push(rel);
            else if (n.endsWith(".css")) cssFiles.push(rel);
        }
    };
    walk(outDir, "");
    jsFiles.sort();
    cssFiles.sort();

    if (jsFiles.length === 0) {
        if (silentOnMissing) return empty;
        throw new Error(`No JS assets found in ${outDir} to inject into SSR template`);
    }

    // 规范化 publicPath，确保以 / 结尾
    const prefix = publicPath.endsWith("/") ? publicPath : publicPath + "/";

    const linkTags = cssFiles
        .map((f) => `    <link rel="stylesheet" href="${prefix}${f}">`)
        .join("\n");
    const scriptTags = jsFiles
        .map((f) => `    <script defer src="${prefix}${f}"></script>`)
        .join("\n");

    // 注入
    let html = fs.readFileSync(sourceTemplate, "utf-8");
    if (linkTags && /<\/head>/i.test(html)) {
        html = html.replace(/<\/head>/i, `${linkTags}\n</head>`);
    }
    if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, `${scriptTags}\n</body>`);
    } else {
        html += `\n${scriptTags}\n`;
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, html, "utf-8");

    return { output: destPath, jsFiles, cssFiles };
}
