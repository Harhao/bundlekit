import path from "path";
import fs from "fs-extra";
import ejs from "ejs";
import { FileManager, Logger } from "@bundlekit/shared-utils";

export interface GeneratorOptions {
    templateDir: string;
    targetDir: string;
    context: Record<string, any>;
}

// 【低14】SSR / Library 相关文件名常量，避免在逻辑中散落硬编码字符串
/** SSR 模式下需要跳过的 non-SSR 入口文件名（不含 .ejs 后缀） */
const NON_SSR_SKIP_NAMES = new Set([
    "index.tsx", "index.jsx", "index.ts", "index.js", "main.ts", "main.js",
    "index.tsx.ejs", "index.jsx.ejs", "index.ts.ejs", "index.js.ejs", "main.ts.ejs", "main.js.ejs",
]);

/** 非 SSR 模式下需要跳过的文件名关键词（这些文件仅用于 SSR） */
const SSR_ONLY_KEYWORDS = ["entry-server", "entry-client"];

/**
 * Library 模式下需要跳过的应用入口 / SSR 入口 / HTML 模板等。
 * Library 模式产物是 SDK，不需要 mount DOM 也不需要 HTML shell。
 * 注意：index.ts.ejs（Node 应用入口）也要跳过，library 入口由 lib-entry 重命名提供。
 */
const NON_LIB_SKIP_NAMES = new Set([
    "index.tsx", "index.jsx", "main.ts", "main.js", "index.ts",
    "index.tsx.ejs", "index.jsx.ejs", "main.ts.ejs", "main.js.ejs", "index.ts.ejs",
]);
const NON_LIB_SKIP_KEYWORDS = ["entry-server", "entry-client"];
/** Library 模式下跳过 public/ 目录（HTML shell） */
const NON_LIB_SKIP_DIRS = new Set(["public"]);
/** 仅 library 模式生效的关键词（这些文件名只在 lib 项目里有意义） */
const LIB_ONLY_KEYWORDS = ["lib-entry"];

export default class Generator {
    private templateDir: string;
    private targetDir: string;
    private context: Record<string, any>;
    private fileManager: FileManager;
    private logger: Logger;

    constructor(options: GeneratorOptions) {
        this.templateDir = options.templateDir;
        this.targetDir = options.targetDir;
        this.context = options.context;
        this.fileManager = new FileManager(options.targetDir);
        this.logger = new Logger();
    }

    async generate() {
        await this.processDir(this.templateDir, this.targetDir);
        this.logger.info(`模板渲染完成: ${this.targetDir}`);
    }

    private async processDir(srcDir: string, destDir: string) {
        const entries = await fs.readdir(srcDir, { withFileTypes: true });

        const isLibrary = !!this.context.library;
        const isSsr = !!this.context.ssr;

        for (const entry of entries) {
            // Library 模式：跳过 public/ HTML shell + 应用入口 + SSR 入口
            if (isLibrary) {
                if (entry.isDirectory() && NON_LIB_SKIP_DIRS.has(entry.name)) continue;
                if (NON_LIB_SKIP_NAMES.has(entry.name)) continue;
                if (NON_LIB_SKIP_KEYWORDS.some((kw) => entry.name.includes(kw))) continue;
            } else {
                // 非 library 模式：跳过 lib 专属入口
                if (LIB_ONLY_KEYWORDS.some((kw) => entry.name.includes(kw))) continue;
            }

            // 非 SSR 项目跳过 SSR 专属文件
            if (!isLibrary && !isSsr && SSR_ONLY_KEYWORDS.some((kw) => entry.name.includes(kw))) {
                continue;
            }
            // SSR 项目跳过 non-SSR 的通用入口文件
            if (isSsr && NON_SSR_SKIP_NAMES.has(entry.name)) {
                continue;
            }

            const srcPath = path.join(srcDir, entry.name);
            // lib-entry.ts.ejs → src/index.ts（library 模式重命名）
            let destName = entry.name.replace(/\.ejs$/, "");
            if (isLibrary && /^lib-entry\.(t|j)sx?$/.test(destName)) {
                destName = destName.replace(/^lib-entry/, "index");
            }
            const destPath = path.join(destDir, destName);

            if (entry.isDirectory()) {
                await fs.ensureDir(destPath);
                await this.processDir(srcPath, destPath);
            } else {
                if (entry.name.endsWith(".ejs")) {
                    const template = await fs.readFile(srcPath, "utf-8");
                    const rendered = ejs.render(template, this.context);
                    await fs.outputFile(destPath, rendered);
                } else {
                    await fs.copyFile(srcPath, destPath);
                }
            }
        }
    }
}
