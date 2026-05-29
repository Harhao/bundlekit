import { describe, it } from "vitest";
import { assertDevSSR } from "../helpers/devSSR";

describe("vite dev-SSR HTTP", () => {
    it("GET / returns 200 with SSR_MARKER", async () => {
        await assertDevSSR("vite");
    }, 120_000);
});
