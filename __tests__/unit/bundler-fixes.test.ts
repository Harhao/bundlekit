import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * 单元测试：校验 5 个真实业务问题的修复点，避免回归。
 *
 *   1. webpack + react-js/vue3-js: ts-loader 处理 .jsx/.js 时需要 typescript，
 *      bundler-webpack 必须将 typescript 声明为 dependency。
 *
 *   2. node-ts 模板: package.json 主入口字段（main / exports）声明的文件名
 *      必须与 bundler 实际输出文件名一致。
 *      webpack / rspack 在字符串 entry 模式下需按 basename 派生 chunk 名，
 *      避免 `[name].js` 永远输出 `app.js` 与模板声明的 `index.js` 错位。
 *
 *   3. vue3 + rspack: vue-loader@17 内部 require('webpack/lib/NormalModule')，
 *      bundler-rspack 必须将 webpack 声明为 dependency。
 *
 *   4. bundler-rollup 安装后无法加载: service 的 rollup 打包配置必须保留
 *      动态 import()（dynamicImportInCjs: true），避免 CJS 输出把
 *      `await import(pathToFileURL(...).href)` 错转为 `require(file://...)`。
 *
 *   5. Generator 的模板渲染（已有覆盖，见 generator-ssr.test.ts）。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function readPackageJson(pkgDir: string): Record<string, any> {
    const p = path.join(pkgDir, "package.json");
    return JSON.parse(fs.readFileSync(p, "utf-8"));
}

// ---------------------------------------------------------------------------
// Issue 1: bundler-webpack 必须显式依赖 typescript（ts-loader 运行时依赖）
// ---------------------------------------------------------------------------
describe("Issue 1: bundler-webpack ts-loader 依赖完整性", () => {
    const pkg = readPackageJson(path.join(repoRoot, "packages/bundlekit-bundler-webpack"));

    it("声明 ts-loader 依赖", () => {
        expect(pkg.dependencies?.["ts-loader"]).toBeDefined();
    });

    it("声明 typescript 依赖（用于 ts-loader 处理 react-js / vue3-js 模板的 .jsx/.js）", () => {
        // ts-loader 的 'Could not load TypeScript' 错误来自此依赖缺失
        expect(pkg.dependencies?.typescript).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// Issue 3: bundler-rspack 必须显式依赖 webpack（vue-loader@17 内部使用）
// ---------------------------------------------------------------------------
describe("Issue 3: bundler-rspack vue-loader 依赖完整性", () => {
    const pkg = readPackageJson(path.join(repoRoot, "packages/bundlekit-bundler-rspack"));

    it("声明 vue-loader 依赖", () => {
        expect(pkg.dependencies?.["vue-loader"]).toBeDefined();
    });

    it("声明 webpack 依赖（vue-loader 内部 require('webpack/lib/NormalModule')）", () => {
        expect(pkg.dependencies?.webpack).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// Issue 4: service 的 rollup.config.js 必须保留动态 import()
// ---------------------------------------------------------------------------
describe("Issue 4: service rollup 配置 dynamicImportInCjs", () => {
    const rollupCfgPath = path.join(repoRoot, "packages/bundlekit-service/scripts/rollup.config.js");
    const src = fs.readFileSync(rollupCfgPath, "utf-8");

    it("CJS 输出保留 dynamicImportInCjs: true，避免 require(file://...) 错误", () => {
        // 直接搜源码，避免 require 解析的 commonjs/esm 摇摆问题
        expect(src).toMatch(/dynamicImportInCjs:\s*true/);
        // 反向兜底：禁止显式写 false
        expect(src).not.toMatch(/dynamicImportInCjs:\s*false/);
    });
});

// ---------------------------------------------------------------------------
// Issue 2: webpack / rspack 字符串 entry 应基于 basename 派生 chunk 名
// ---------------------------------------------------------------------------
describe("Issue 2: 字符串 entry → chunk 名按 basename 派生", () => {
    // 直接对源码做静态校验，避免引入 webpack / rspack / html-webpack-plugin 等重型依赖
    const webpackSrc = fs.readFileSync(
        path.join(repoRoot, "packages/bundlekit-bundler-webpack/src/transformConfig.ts"),
        "utf-8",
    );
    const rspackSrc = fs.readFileSync(
        path.join(repoRoot, "packages/bundlekit-bundler-rspack/src/index.ts"),
        "utf-8",
    );

    it("webpack adapter 不再硬编码 chunk 名 'app'", () => {
        // 旧实现：{ app: this.buildConfig.entry }
        expect(webpackSrc).not.toMatch(/\{\s*app:\s*this\.buildConfig\.entry\s*\}/);
        // 新实现：deriveChunkName 派生
        expect(webpackSrc).toMatch(/deriveChunkName\s*\(/);
        expect(webpackSrc).toMatch(/function deriveChunkName/);
    });

    it("rspack adapter 不再硬编码 chunk 名 'app'", () => {
        expect(rspackSrc).not.toMatch(/\{\s*app:\s*rawEnvConfig\.entry\s*\}/);
        expect(rspackSrc).toMatch(/deriveChunkName\s*\(/);
        expect(rspackSrc).toMatch(/function deriveChunkName/);
    });

    /** 复现 deriveChunkName 行为本身的纯函数测试。 */
    function deriveChunkName(entry: string): string {
        const base = path.basename(entry, path.extname(entry));
        return base || "app";
    }

    it("deriveChunkName 在常见模板路径下与 package.json 主入口一致", () => {
        // node-ts 默认入口 → main: ./dist/index.js
        expect(deriveChunkName("src/index.ts")).toBe("index");
        // react-ts SSR 服务端 → 子产物
        expect(deriveChunkName("./src/entry-server.tsx")).toBe("entry-server");
        // vue3-js 默认入口
        expect(deriveChunkName("src/main.js")).toBe("main");
        // 异常兜底
        expect(deriveChunkName("")).toBe("app");
    });
});

// ---------------------------------------------------------------------------
// 模板自洽性：node-ts package.json 与 .bundlekitrc 声明对齐
// ---------------------------------------------------------------------------
describe("node-ts 模板：package.json 主入口与 bundler 输出文件名一致", () => {
    const tplDir = path.join(repoRoot, "packages/bundlekit-plugin-node/templates/template-node-ts");
    const pkgEjs = fs.readFileSync(path.join(tplDir, "package.json.ejs"), "utf-8");
    const rcEjs = fs.readFileSync(path.join(tplDir, ".bundlekitrc.ts.ejs"), "utf-8");

    it("入口源文件名（src/index.ts）与 main 字段（./dist/index.js）的 basename 一致", () => {
        // .bundlekitrc 中 entry 是 src/index.ts
        expect(rcEjs).toMatch(/entry:\s*"src\/index\.ts"/);
        // package.json.ejs 默认分支 main 为 ./dist/index.js
        expect(pkgEjs).toMatch(/"main":\s*"\.\/dist\/index\.js"/);
        // package.json.ejs library + rollup/rolldown 分支：./dist/index.cjs 与 ./dist/index.mjs
        expect(pkgEjs).toMatch(/"main":\s*"\.\/dist\/index\.cjs"/);
        expect(pkgEjs).toMatch(/"module":\s*"\.\/dist\/index\.mjs"/);
    });
});
