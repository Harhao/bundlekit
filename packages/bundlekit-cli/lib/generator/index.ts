import path from "path";
import fs from "fs-extra";
import ejs from "ejs";
import { FileManager, Logger } from "@bundlekit/shared-utils";

export interface GeneratorOptions {
    templateDir: string;
    targetDir: string;
    context: Record<string, any>;
}

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
            if (!this.context.ssr && (entry.name.includes('entry-server') || entry.name.includes('entry-client'))) {
                continue;
            }
            if (this.context.ssr && (entry.name === 'index.tsx' || entry.name === 'index.jsx' || entry.name === 'main.ts' || entry.name === 'main.js' || entry.name === 'index.tsx.ejs' || entry.name === 'index.jsx.ejs' || entry.name === 'main.ts.ejs' || entry.name === 'main.js.ejs')) {
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
