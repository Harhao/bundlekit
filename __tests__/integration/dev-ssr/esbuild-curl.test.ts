import { describe, it } from "vitest";
import { assertDevSSR } from "../helpers/devSSR";

describe("esbuild dev-SSR HTTP", () => {
    it("GET / returns 200 with SSR_MARKER", async () => {
        await assertDevSSR("esbuild");
    }, 120_000);
});
