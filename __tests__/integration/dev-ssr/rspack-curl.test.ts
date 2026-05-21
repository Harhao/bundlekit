import { describe, it } from "vitest";
import { assertDevSSR } from "../helpers/devSSR";

describe("rspack dev SSR HTTP", () => {
    it("GET / returns 200 with SSR_MARKER", async () => {
        await assertDevSSR("rspack");
    }, 90_000);
});
