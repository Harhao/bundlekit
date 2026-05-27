import { describe, it } from "vitest";
import { assertSsrBuild } from "../helpers/buildAssertions";

describe("rspack SSR build", () => {
    it("dist/client/index.html has <script>, dist/server/server.cjs render() returns SSR_MARKER", async () => {
        await assertSsrBuild("rspack");
    }, 180_000);
});
