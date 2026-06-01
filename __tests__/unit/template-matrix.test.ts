import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import { Creator } from "../../packages/bundlekit-cli/lib/commands/create/creator";

/**
 * 模板 × 包管理器 × 打包工具 全组合矩阵测试
 *
 * 维度：7 × 3 × 7 = 147 个组合
 *   - 模板：react-ts / react-js / vue3-ts / vue3-js / svelte-ts / svelte-js / node-ts
 *   - 包管理器：pnpm / yarn / npm
 *   - 打包工具：webpack / vite / rspack / rollup / rolldown / parcel / esbuild
 *
 * 每个组合验证 `cli create` 的产物：
 *   1. 项目目录、package.json、.bundlekitrc.* 均生成且可解析
 *   2. devDependencies 包含正确的 service / plugin / bundler 包
 *   3. 不含 workspace:^ 残留，不含 ^1.0.0 死硬编码版本
 *   4. 入口源文件存在且与 .bundlekitrc 中 entry 字段一致
 *   5. node-ts 模板：package.json main 字段路径与字符串 entry 的 basename 一致
 *      （回归保护 Issue 2 — 输出文件名与 main 字段错位）
 *
 * 跑法：
 *   pnpm test __tests__/unit/template-matrix.test.ts
 *
 * 速度：DEVKIT_SKIP_INSTALL=1 + DEVKIT_NO_PROMPT=1 + DEVKIT_QUIET=1，
 * 每个组合仅做模板渲染 + 依赖规范化 + generator 静默调用，<200ms。
 */

type Template = "react-ts" | "react-js" | "vue3-ts" | "vue3-js" | "svelte-ts" | "svelte-js" | "node-ts";
type PM = "pnpm" | "yarn" | "npm";
type Bundler = "webpack" | "vite" | "rspack" | "rollup" | "rolldown" | "parcel" | "esbuild";

const TEMPLATES: Template[] = ["react-ts", "react-js", "vue3-ts", "vue3-js", "svelte-ts", "svelte-js", "node-ts"];
const PMS: PM[] = ["pnpm", "yarn", "npm"];
const BUNDLERS: Bundler[] = ["webpack", "vite", "rspack", "rollup", "rolldown", "parcel", "esbuild"];

/** 模板 → 期望的 plugin npm 包名 */
const PLUGIN_PKG: Record<Template, string> = {
    "react-ts":  "@bundlekit/plugin-react",
    "react-js":  "@bundlekit/plugin-react",
    "vue3-ts":   "@bundlekit/plugin-vue",
    "vue3-js":   "@bundlekit/plugin-vue",
    "svelte-ts": "@bundlekit/plugin-svelte",
    "svelte-js": "@bundlekit/plugin-svelte",
    "node-ts":   "@bundlekit/plugin-node",
};

/** 模板 → CSR 默认入口源文件（无 SSR 时） */
const TEMPLATE_ENTRY: Record<Template, string> = {
    "react-ts":  "src/index.tsx",
    "react-js":  "src/index.jsx",
    "vue3-ts":   "src/main.ts",
    "vue3-js":   "src/main.js",
    "svelte-ts": "src/index.ts",
    "svelte-js": "src/index.js",
    "node-ts":   "src/index.ts",
};

/** 模板 → 期望的 .bundlekitrc 文件名 */
const TEMPLATE_RC: Record<Template, string> = {
    "react-ts":  ".bundlekitrc.ts",
    "react-js":  ".bundlekitrc.js",
    "vue3-ts":   ".bundlekitrc.ts",
    "vue3-js":   ".bundlekitrc.js",
    "svelte-ts": ".bundlekitrc.ts",
    "svelte-js": ".bundlekitrc.js",
    "node-ts":   ".bundlekitrc.ts",
};

let rootTmpDir: string;

beforeAll(async () => {
    // 静默 Logger / 跳过 prompt / 跳过 install — 加速 + 避免污染输出
    process.env.DEVKIT_QUIET = "1";
    process.env.DEVKIT_NO_PROMPT = "1";
    process.env.DEVKIT_SKIP_INSTALL = "1";
    process.env.CI = "true";
    rootTmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "bundlekit-matrix-"));
});

afterAll(async () => {
    try { await fsp.rm(rootTmpDir, { recursive: true, force: true }); } catch {}
});

interface CreatedProject {
    projectDir: string;
    pkg: Record<string, any>;
    rcContent: string;
    rcPath: string;
}

async function createProject(
    template: Template,
    pm: PM,
    bundler: Bundler,
    label: string,
): Promise<CreatedProject> {
    const cwd = await fsp.mkdtemp(path.join(rootTmpDir, `${label}-`));
    const projectName = "demo-app";
    const creator = new Creator();
    await creator.create(projectName, {
        cwd,
        template,
        bundler,
        pm,
        description: "matrix test",
    });
    const projectDir = path.join(cwd, projectName);
    const pkgPath = path.join(projectDir, "package.json");
    const pkg = JSON.parse(await fsp.readFile(pkgPath, "utf-8"));
    const rcPath = path.join(projectDir, TEMPLATE_RC[template]);
    const rcContent = fs.existsSync(rcPath) ? await fsp.readFile(rcPath, "utf-8") : "";
    return { projectDir, pkg, rcContent, rcPath };
}

// ---------------------------------------------------------------------------
// 公共断言：5 类不变量
// ---------------------------------------------------------------------------

function assertCommonInvariants(opts: {
    proj: CreatedProject;
    template: Template;
    bundler: Bundler;
}): void {
    const { proj, template, bundler } = opts;
    const { projectDir, pkg, rcContent, rcPath } = proj;

    // 1. 项目目录 + package.json 存在
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(pkg.name).toBe("demo-app");
    expect(pkg.scripts?.dev).toBeDefined();
    expect(pkg.scripts?.build).toBeDefined();
    expect(pkg.scripts?.dev).toContain(`--bundler ${bundler}`);
    expect(pkg.scripts?.build).toContain(`--bundler ${bundler}`);

    // 2. devDependencies 含 service + plugin + bundler
    const devDeps = pkg.devDependencies || {};
    expect(devDeps["@bundlekit/service"]).toMatch(/^\^\d+\.\d+\.\d+$/);
    expect(devDeps[PLUGIN_PKG[template]]).toMatch(/^\^\d+\.\d+\.\d+$/);
    expect(devDeps[`@bundlekit/bundler-${bundler}`]).toMatch(/^\^/);

    // 3. 不含 workspace:^ 残留 / ^1.0.0 死硬编码
    const pkgText = JSON.stringify(pkg);
    expect(pkgText, "package.json 不应残留 workspace:").not.toContain("workspace:");
    expect(pkgText, "package.json 不应包含 ^1.0.0 死硬编码").not.toContain('"^1.0.0"');

    // 4. .bundlekitrc.* 存在且内容含正确的 bundler 与 plugin
    expect(fs.existsSync(rcPath), `${TEMPLATE_RC[template]} 应存在`).toBe(true);
    expect(rcContent).toContain(`bundler: "${bundler}"`);
    expect(rcContent).toContain(PLUGIN_PKG[template]);

    // 5. 入口源文件存在
    const entryFile = TEMPLATE_ENTRY[template];
    const entryPath = path.join(projectDir, entryFile);
    expect(fs.existsSync(entryPath), `入口源文件 ${entryFile} 应存在`).toBe(true);
    // .bundlekitrc 中 entry 字段应指向该文件
    expect(rcContent).toContain(`entry: "${entryFile}"`);
}

// ---------------------------------------------------------------------------
// 矩阵：5 × 3 × 7 = 105 组合
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 矩阵：7 模板 × 3 PM × 7 bundler = 147 组合
// 减去 2 个已知不兼容（svelte-ts/js × parcel）= 实际 145 组合（参与跑的 + 跳过 6 个）
// ---------------------------------------------------------------------------

/** 已知不兼容组合：cli create 会主动拒绝，不应参与"产出可用模板"矩阵 */
function isIncompatibleCombo(template: Template, bundler: Bundler): boolean {
    if ((template === "svelte-ts" || template === "svelte-js") && bundler === "parcel") return true;
    return false;
}

describe("Create matrix (7 templates × 3 PMs × 7 bundlers = 147 combos)", () => {
    // 矩阵测试可能耗时 20-30s，提升 timeout
    const allCombos: Array<{ template: Template; pm: PM; bundler: Bundler; label: string; incompatible: boolean }> = [];
    for (const template of TEMPLATES) {
        for (const pm of PMS) {
            for (const bundler of BUNDLERS) {
                allCombos.push({
                    template, pm, bundler,
                    label: `${template} · ${pm} · ${bundler}`,
                    incompatible: isIncompatibleCombo(template, bundler),
                });
            }
        }
    }

    const validCombos = allCombos.filter((c) => !c.incompatible);
    const incompatCombos = allCombos.filter((c) => c.incompatible);

    it.each(validCombos)(
        "[$label] cli create 产出可用模板",
        async ({ template, pm, bundler, label }) => {
            const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-");
            const proj = await createProject(template, pm, bundler, safeLabel);
            assertCommonInvariants({ proj, template, bundler });
        },
        15_000,
    );

    // 不兼容组合：Creator 应主动 throw 并清理半成品目录
    it.each(incompatCombos)(
        "[$label] cli create 主动报错（不兼容组合）",
        async ({ template, pm, bundler, label }) => {
            const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-");
            const cwd = await fsp.mkdtemp(path.join(rootTmpDir, `incompat-${safeLabel}-`));
            const creator = new Creator();
            await expect(
                creator.create("demo-app", {
                    cwd,
                    template,
                    bundler,
                    pm,
                    description: "incompat test",
                }),
            ).rejects.toThrow();
            // 失败时不应残留项目目录
            expect(fs.existsSync(path.join(cwd, "demo-app"))).toBe(false);
        },
        10_000,
    );
});

// ---------------------------------------------------------------------------
// 模板专项：node-ts 的 main 字段必须与字符串 entry 的 basename 对齐
// （Issue 2 回归保护）
// ---------------------------------------------------------------------------

describe("node-ts: package.json main / module 路径与 entry basename 对齐", () => {
    /**
     * .bundlekitrc 默认 entry: "src/index.ts"，basename = "index"
     *
     * 期望 package.json:
     *   - main: "./dist/index.js"（默认）
     *   - 或 main: "./dist/index.cjs" + module: "./dist/index.mjs"（library + rollup/rolldown）
     *
     * 输出文件名应永远是 "index.*" 而非 "app.*"，否则 require("demo-app") 会 404。
     */
    it.each(BUNDLERS)(
        "node-ts × %s · package.json 主入口路径以 ./dist/index. 开头",
        async (bundler) => {
            const proj = await createProject("node-ts", "pnpm", bundler, `nodets-${bundler}`);
            const main = proj.pkg.main as string | undefined;
            expect(main, "node-ts 模板必须声明 main 字段").toBeDefined();
            // 接受 ./dist/index.js / ./dist/index.cjs；防御非 index 命名
            expect(main).toMatch(/^\.\/dist\/index\.(js|cjs|mjs)$/);

            // .bundlekitrc 中 entry 字段是 src/index.ts，basename → index
            expect(proj.rcContent).toMatch(/entry:\s*"src\/index\.ts"/);
        },
        15_000,
    );
});

// ---------------------------------------------------------------------------
// 模板专项：SSR 模式 — entry 文件切到 entry-client/entry-server
// （回归保护 generator-ssr.test.ts 的端到端版本）
// ---------------------------------------------------------------------------

describe("SSR 模式：CSR 入口被替换为 entry-client/entry-server", () => {
    const ssrCombos: Array<{ template: Template; clientFile: string; serverFile: string }> = [
        { template: "react-ts",  clientFile: "src/entry-client.tsx", serverFile: "src/entry-server.tsx" },
        { template: "react-js",  clientFile: "src/entry-client.jsx", serverFile: "src/entry-server.jsx" },
        { template: "vue3-ts",   clientFile: "src/entry-client.ts",  serverFile: "src/entry-server.ts" },
        { template: "vue3-js",   clientFile: "src/entry-client.js",  serverFile: "src/entry-server.js" },
        { template: "svelte-ts", clientFile: "src/entry-client.ts",  serverFile: "src/entry-server.ts" },
        { template: "svelte-js", clientFile: "src/entry-client.js",  serverFile: "src/entry-server.js" },
    ];

    it.each(ssrCombos)(
        "$template --ssr 生成 $clientFile / $serverFile",
        async ({ template, clientFile, serverFile }) => {
            const cwd = await fsp.mkdtemp(path.join(rootTmpDir, `ssr-${template}-`));
            const creator = new Creator();
            await creator.create("demo-ssr", {
                cwd,
                template,
                bundler: "vite",
                pm: "pnpm",
                ssr: true,
            });
            const projectDir = path.join(cwd, "demo-ssr");
            expect(fs.existsSync(path.join(projectDir, clientFile))).toBe(true);
            expect(fs.existsSync(path.join(projectDir, serverFile))).toBe(true);
            // CSR 入口被跳过
            const csrEntry = TEMPLATE_ENTRY[template];
            expect(fs.existsSync(path.join(projectDir, csrEntry))).toBe(false);

            // .bundlekitrc 应包含 ssr 配置块
            const rc = await fsp.readFile(
                path.join(projectDir, TEMPLATE_RC[template]),
                "utf-8",
            );
            expect(rc).toContain("ssr:");
            expect(rc).toContain("entry-server");
        },
        15_000,
    );
});

// ---------------------------------------------------------------------------
// node-ts 不支持 SSR：CLI 应明确报错而不是静默吞掉 --ssr
// ---------------------------------------------------------------------------

describe("node-ts × --ssr：明确报错（不支持 SSR）", () => {
    it("Creator.create 抛出含 'node-ts 模板不支持 SSR' 的错误", async () => {
        const cwd = await fsp.mkdtemp(path.join(rootTmpDir, "nodets-ssr-"));
        const creator = new Creator();
        await expect(
            creator.create("demo-bad", {
                cwd,
                template: "node-ts",
                bundler: "rollup",
                pm: "pnpm",
                ssr: true,
            }),
        ).rejects.toThrow(/node-ts.*不支持 SSR/);

        // 失败时不应残留半成品项目目录
        expect(fs.existsSync(path.join(cwd, "demo-bad"))).toBe(false);
    }, 10_000);

    it("ssr: false（默认）不影响 node-ts 正常生成", async () => {
        const cwd = await fsp.mkdtemp(path.join(rootTmpDir, "nodets-nossr-"));
        const creator = new Creator();
        await creator.create("demo-ok", {
            cwd,
            template: "node-ts",
            bundler: "rollup",
            pm: "pnpm",
            ssr: false,
        });
        expect(fs.existsSync(path.join(cwd, "demo-ok/package.json"))).toBe(true);
        // 没有 entry-server / entry-client 文件
        expect(fs.existsSync(path.join(cwd, "demo-ok/src/entry-server.ts"))).toBe(false);
        expect(fs.existsSync(path.join(cwd, "demo-ok/src/entry-client.ts"))).toBe(false);
    }, 15_000);
});

// ---------------------------------------------------------------------------
// 模板 × 打包器组合校验：svelte × parcel 应在 cli 层早早拦截
// （根因：Parcel 没有官方 svelte transformer，社区版仅兼容 svelte 3）
// ---------------------------------------------------------------------------

describe("svelte × parcel：明确报错（不兼容组合）", () => {
    it.each(["svelte-ts", "svelte-js"] as const)(
        "Creator.create(template=%s, bundler=parcel) 抛出含 'parcel' 的错误",
        async (template) => {
            const cwd = await fsp.mkdtemp(path.join(rootTmpDir, `${template}-parcel-`));
            const creator = new Creator();
            await expect(
                creator.create("demo-bad", {
                    cwd,
                    template,
                    bundler: "parcel",
                    pm: "pnpm",
                }),
            ).rejects.toThrow(/parcel/i);

            // 失败时不应残留半成品项目目录
            expect(fs.existsSync(path.join(cwd, "demo-bad"))).toBe(false);
        },
        10_000,
    );

    it("checkTemplateBundlerCombo 工具函数行为正确", async () => {
        const { checkTemplateBundlerCombo } = await import(
            "../../packages/bundlekit-cli/lib/commands/create/actions"
        );
        // svelte × parcel：不兼容
        expect(checkTemplateBundlerCombo("svelte-ts", "parcel")).toMatch(/parcel/);
        expect(checkTemplateBundlerCombo("svelte-js", "parcel")).toMatch(/parcel/);
        expect(checkTemplateBundlerCombo("svelte", "parcel")).toMatch(/parcel/);
        // 其他组合：返回 null
        expect(checkTemplateBundlerCombo("svelte-ts", "vite")).toBeNull();
        expect(checkTemplateBundlerCombo("svelte-ts", "webpack")).toBeNull();
        expect(checkTemplateBundlerCombo("react-ts", "parcel")).toBeNull();
        expect(checkTemplateBundlerCombo("vue3-ts", "parcel")).toBeNull();
        expect(checkTemplateBundlerCombo("node-ts", "parcel")).toBeNull();
    });
});
