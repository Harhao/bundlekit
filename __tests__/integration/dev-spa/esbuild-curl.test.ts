import { describe, it } from "vitest";
import { assertDevSPA } from "../helpers/devSPA";

describe("esbuild dev SPA HTTP", () => {
    it("GET / 返回 HTML + 注入入口 + bundle 可下载", async () => {
        await assertDevSPA("esbuild");
    }, 120_000);
});
