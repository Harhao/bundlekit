import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import Generator from "../../packages/bundlekit-cli/lib/generator";

/**
 * Generator SSR file filtering unit tests
 *
 * Verifies that the Generator correctly includes/excludes files based on the `ssr` context:
 * - ssr=false: skip entry-server and entry-client files
 * - ssr=true: skip CSR-only entry files (index.tsx, main.ts, etc.)
 */

async function makeTmpDir(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), "generator-test-"));
}

async function createTemplateFiles(dir: string, files: string[]) {
    for (const file of files) {
        const filePath = path.join(dir, file);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `<%= projectName %> - ${file}`, "utf-8");
    }
}

async function getOutputFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const subFiles = await getOutputFiles(path.join(dir, entry.name));
            files.push(...subFiles.map((f) => path.join(entry.name, f)));
        } else {
            files.push(entry.name);
        }
    }
    return files.sort();
}

/** Check if any file in the list ends with the given name */
function containsFile(files: string[], name: string): boolean {
    return files.some((f) => f.endsWith(name) || f === name);
}

describe("Generator SSR file filtering", () => {
    let tmpDir: string;
    let templateDir: string;
    let outputDir: string;

    beforeEach(async () => {
        tmpDir = await makeTmpDir();
        templateDir = path.join(tmpDir, "template");
        outputDir = path.join(tmpDir, "output");
        await fs.mkdir(templateDir, { recursive: true });
        await fs.mkdir(outputDir, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    describe("ssr=false (CSR mode)", () => {
        it("skips entry-server files", async () => {
            await createTemplateFiles(templateDir, [
                "src/index.tsx.ejs",
                "src/App.tsx.ejs",
                "src/entry-server.tsx.ejs",
                "src/entry-client.tsx.ejs",
            ]);

            const generator = new Generator({
                templateDir,
                targetDir: outputDir,
                context: { projectName: "test", description: "", bundler: "vite", ssr: false },
            });
            await generator.generate();

            const files = await getOutputFiles(outputDir);
            expect(containsFile(files, "index.tsx")).toBe(true);
            expect(containsFile(files, "App.tsx")).toBe(true);
            expect(containsFile(files, "entry-server.tsx")).toBe(false);
            expect(containsFile(files, "entry-client.tsx")).toBe(false);
        });

        it("skips entry-server and entry-client for vue templates", async () => {
            await createTemplateFiles(templateDir, [
                "src/main.ts",
                "src/App.vue.ejs",
                "src/entry-server.ts",
                "src/entry-client.ts",
            ]);

            const generator = new Generator({
                templateDir,
                targetDir: outputDir,
                context: { projectName: "test", description: "", bundler: "vite", ssr: false },
            });
            await generator.generate();

            const files = await getOutputFiles(outputDir);
            expect(containsFile(files, "main.ts")).toBe(true);
            expect(containsFile(files, "App.vue")).toBe(true);
            expect(containsFile(files, "entry-server.ts")).toBe(false);
            expect(containsFile(files, "entry-client.ts")).toBe(false);
        });

        it("generates CSR entry files", async () => {
            await createTemplateFiles(templateDir, [
                "src/index.tsx.ejs",
                "src/index.jsx.ejs",
                "src/main.ts",
                "src/main.js",
            ]);

            const generator = new Generator({
                templateDir,
                targetDir: outputDir,
                context: { projectName: "test", description: "", bundler: "vite", ssr: false },
            });
            await generator.generate();

            const files = await getOutputFiles(outputDir);
            expect(containsFile(files, "index.tsx")).toBe(true);
            expect(containsFile(files, "index.jsx")).toBe(true);
            expect(containsFile(files, "main.ts")).toBe(true);
            expect(containsFile(files, "main.js")).toBe(true);
        });
    });

    describe("ssr=true (SSR mode)", () => {
        it("generates entry-server and entry-client files", async () => {
            await createTemplateFiles(templateDir, [
                "src/entry-server.tsx.ejs",
                "src/entry-client.tsx.ejs",
                "src/App.tsx.ejs",
            ]);

            const generator = new Generator({
                templateDir,
                targetDir: outputDir,
                context: { projectName: "test", description: "", bundler: "vite", ssr: true },
            });
            await generator.generate();

            const files = await getOutputFiles(outputDir);
            expect(containsFile(files, "entry-server.tsx")).toBe(true);
            expect(containsFile(files, "entry-client.tsx")).toBe(true);
            expect(containsFile(files, "App.tsx")).toBe(true);
        });

        it("skips CSR-only entry files (index.tsx, index.jsx)", async () => {
            await createTemplateFiles(templateDir, [
                "src/index.tsx.ejs",
                "src/index.jsx.ejs",
                "src/entry-server.tsx.ejs",
                "src/entry-client.tsx.ejs",
            ]);

            const generator = new Generator({
                templateDir,
                targetDir: outputDir,
                context: { projectName: "test", description: "", bundler: "vite", ssr: true },
            });
            await generator.generate();

            const files = await getOutputFiles(outputDir);
            expect(containsFile(files, "index.tsx")).toBe(false);
            expect(containsFile(files, "index.jsx")).toBe(false);
            expect(containsFile(files, "entry-server.tsx")).toBe(true);
            expect(containsFile(files, "entry-client.tsx")).toBe(true);
        });

        it("skips CSR-only entry files for vue (main.ts, main.js)", async () => {
            await createTemplateFiles(templateDir, [
                "src/main.ts",
                "src/main.js",
                "src/entry-server.ts",
                "src/entry-client.ts",
            ]);

            const generator = new Generator({
                templateDir,
                targetDir: outputDir,
                context: { projectName: "test", description: "", bundler: "vite", ssr: true },
            });
            await generator.generate();

            const files = await getOutputFiles(outputDir);
            expect(containsFile(files, "main.ts")).toBe(false);
            expect(containsFile(files, "main.js")).toBe(false);
            expect(containsFile(files, "entry-server.ts")).toBe(true);
            expect(containsFile(files, "entry-client.ts")).toBe(true);
        });

        it("skips .ejs variants of CSR entries", async () => {
            await createTemplateFiles(templateDir, [
                "src/index.tsx.ejs",
                "src/main.ts.ejs",
                "src/entry-server.tsx.ejs",
            ]);

            const generator = new Generator({
                templateDir,
                targetDir: outputDir,
                context: { projectName: "test", description: "", bundler: "vite", ssr: true },
            });
            await generator.generate();

            const files = await getOutputFiles(outputDir);
            expect(containsFile(files, "index.tsx")).toBe(false);
            expect(containsFile(files, "main.ts")).toBe(false);
            expect(containsFile(files, "entry-server.tsx")).toBe(true);
        });
    });

    describe("shared files", () => {
        it("always generates shared files regardless of ssr setting", async () => {
            await createTemplateFiles(templateDir, [
                "src/App.tsx.ejs",
                "src/components/Header.tsx.ejs",
                "src/styles/main.css",
            ]);

            // Test with ssr=false
            const generatorFalse = new Generator({
                templateDir,
                targetDir: path.join(tmpDir, "output-false"),
                context: { projectName: "test", description: "", bundler: "vite", ssr: false },
            });
            await fs.mkdir(path.join(tmpDir, "output-false"), { recursive: true });
            await generatorFalse.generate();

            const filesFalse = await getOutputFiles(path.join(tmpDir, "output-false"));
            expect(containsFile(filesFalse, "App.tsx")).toBe(true);
            expect(containsFile(filesFalse, "Header.tsx")).toBe(true);
            expect(containsFile(filesFalse, "main.css")).toBe(true);

            // Test with ssr=true
            const generatorTrue = new Generator({
                templateDir,
                targetDir: path.join(tmpDir, "output-true"),
                context: { projectName: "test", description: "", bundler: "vite", ssr: true },
            });
            await fs.mkdir(path.join(tmpDir, "output-true"), { recursive: true });
            await generatorTrue.generate();

            const filesTrue = await getOutputFiles(path.join(tmpDir, "output-true"));
            expect(containsFile(filesTrue, "App.tsx")).toBe(true);
            expect(containsFile(filesTrue, "Header.tsx")).toBe(true);
            expect(containsFile(filesTrue, "main.css")).toBe(true);
        });
    });

    describe("EJS rendering", () => {
        it("renders EJS variables correctly", async () => {
            await createTemplateFiles(templateDir, [
                "src/index.tsx.ejs",
            ]);
            // Overwrite with EJS content
            await fs.writeFile(
                path.join(templateDir, "src/index.tsx.ejs"),
                "const appName = '<%= projectName %>';",
                "utf-8",
            );

            const generator = new Generator({
                templateDir,
                targetDir: outputDir,
                context: { projectName: "my-app", description: "", bundler: "vite", ssr: false },
            });
            await generator.generate();

            const content = await fs.readFile(path.join(outputDir, "src/index.tsx"), "utf-8");
            expect(content).toBe("const appName = 'my-app';");
        });
    });
});
