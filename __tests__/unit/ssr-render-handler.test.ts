import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createSSRRequestHandler } from "../../packages/bundlekit-shared-utils/lib/shared/ssrRender";
import type { ISSRConfig } from "../../packages/bundlekit-shared-utils/lib/types";

function makeReqRes(url = "/") {
    const req: any = { url };
    const headers: Record<string, string> = {};
    let body = "";
    let statusCode = 0;
    let headersSent = false;
    const res: any = {
        get statusCode() { return statusCode; },
        set statusCode(v: number) { statusCode = v; },
        get headersSent() { return headersSent; },
        setHeader(k: string, v: string) { headers[k] = v; },
        end(payload?: string) { body = payload || ""; headersSent = true; },
        getBody: () => body,
        getStatus: () => statusCode,
        getHeaders: () => headers,
    };
    return { req, res };
}

function setupBundleFixture(renderFn: (url: string) => any): { context: string; bundlePath: string; templatePath: string } {
    const context = fs.mkdtempSync(path.join(os.tmpdir(), "ssr-render-test-"));
    const bundleDir = path.join(context, "dist", "server");
    fs.mkdirSync(bundleDir, { recursive: true });
    const bundlePath = path.join(bundleDir, "server.cjs");

    const renderSrc = `module.exports.render = ${renderFn.toString()};`;
    fs.writeFileSync(bundlePath, renderSrc, "utf-8");

    const templateDir = path.join(context, "public");
    fs.mkdirSync(templateDir, { recursive: true });
    const templatePath = path.join(templateDir, "index.html");
    fs.writeFileSync(
        templatePath,
        "<!DOCTYPE html><html><body><div id=\"root\"><!--ssr-outlet--></div></body></html>",
        "utf-8",
    );

    return { context, bundlePath, templatePath };
}

describe("createSSRRequestHandler render signatures", () => {
    it("handles sync string render", async () => {
        const { context, bundlePath } = setupBundleFixture(((_url: string) => "<h1>SYNC</h1>") as any);

        const ssrConfig: ISSRConfig = {
            entry: "src/entry-server.ts",
            output: { dir: "dist/server", filename: "server.cjs", formats: "commonjs" },
            template: "public/index.html",
            placeholder: "<!--ssr-outlet-->",
        };
        const handler = createSSRRequestHandler({
            context,
            ssrConfig,
            serverBundlePath: () => bundlePath,
        });

        const { req, res } = makeReqRes("/");
        await handler(req, res);

        expect(res.getStatus()).toBe(200);
        expect(res.getBody()).toContain("<h1>SYNC</h1>");
        expect(res.getBody()).not.toContain("<!--ssr-outlet-->");
    });

    it("handles async Promise<string> render (Angular renderApplication shape)", async () => {
        const { context, bundlePath } = setupBundleFixture(((_url: string) =>
            Promise.resolve("<h1>ASYNC</h1>")
        ) as any);

        const ssrConfig: ISSRConfig = {
            entry: "src/entry-server.ts",
            output: { dir: "dist/server", filename: "server.cjs", formats: "commonjs" },
            template: "public/index.html",
            placeholder: "<!--ssr-outlet-->",
        };
        const handler = createSSRRequestHandler({
            context,
            ssrConfig,
            serverBundlePath: () => bundlePath,
        });

        const { req, res } = makeReqRes("/");
        await handler(req, res);

        expect(res.getStatus()).toBe(200);
        expect(res.getBody()).toContain("<h1>ASYNC</h1>");
        expect(res.getBody()).not.toContain("[object Promise]");
    });

    it("handles rejecting Promise render with 500 + stack overlay", async () => {
        const { context, bundlePath } = setupBundleFixture(((_url: string) =>
            Promise.reject(new Error("boom from angular renderApplication"))
        ) as any);

        const ssrConfig: ISSRConfig = {
            entry: "src/entry-server.ts",
            output: { dir: "dist/server", filename: "server.cjs", formats: "commonjs" },
            template: "public/index.html",
            placeholder: "<!--ssr-outlet-->",
        };
        const onError = vi.fn();
        const handler = createSSRRequestHandler({
            context,
            ssrConfig,
            serverBundlePath: () => bundlePath,
            onError,
        });

        const { req, res } = makeReqRes("/");
        await handler(req, res);

        expect(res.getStatus()).toBe(500);
        expect(res.getBody()).toContain("SSR render error");
        expect(res.getBody()).toContain("boom from angular renderApplication");
        expect(onError).toHaveBeenCalledOnce();
    });
});
