import { describe, it } from "vitest";
import { assertDevSSR } from "../helpers/devSSR";

describe("webpack dev-SSR HTTP", () => {
    it("GET / returns 200 with SSR_MARKER", async () => {
        await assertDevSSR("webpack");
    }, 120_000);
});
