import { describe, it } from "vitest";
import { assertDevSSR } from "../helpers/devSSR";

describe("rollup dev-SSR HTTP", () => {
    it("GET / returns 200 with SSR_MARKER", async () => {
        await assertDevSSR("rollup");
    }, 120_000);
});
