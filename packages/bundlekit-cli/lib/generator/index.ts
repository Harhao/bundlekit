import path from "path";
import fs from "fs-extra";
import ejs from "ejs";
import { FileManager, Logger } from "@bundlekit/shared-utils";

export interface GeneratorOptions {
    templateDir: string;
    targetDir: string;
    context: Record<string, any>;
}

// 【低14】SSR 相关文件名常量，避免在逻辑中散落硬编码字符串
/** SSR 模式下需要跳过的 non-SSR 入口文件名（不含 .ejs 后缀） */
const NON_SSR_SKIP_NAMES = new Set([
    "index.tsx", "index.jsx", "main.ts", "main.js",
    "index.tsx.ejs", "index.jsx.ejs", "main.ts.ejs", "main.js.ejs",
]);

/** 非 SSR 模式下需要跳过的文件名关键词（这些文件仅用于 SSR） */
const SSR_ONLY_KEYWORDS = ["entry-server", "entry-client"];

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

        for (const entry of entries) {
            // 非 SSR 项目跳过 SSR 专属文件
            if (!this.context.ssr && SSR_ONLY_KEYWORDS.some((kw) => entry.name.includes(kw))) {
                continue;
            }
            // SSR 项目跳过 non-SSR 的通用入口文件
            if (this.context.ssr && NON_SSR_SKIP_NAMES.has(entry.name)) {
                continue;
            }

            const srcPath = path.join(srcDir, entry.name);
            const destName = entry.name.replace(/\.ejs$/, "");
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
