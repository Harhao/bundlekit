import { describe, it } from "vitest";
import { assertDevSSR } from "../helpers/devSSR";

describe("parcel dev-SSR HTTP", () => {
    it("GET / returns 200 with SSR_MARKER", async () => {
        await assertDevSSR("parcel");
    }, 120_000);
});
