import { describe, it } from "vitest";
import { assertSsrBuild } from "../helpers/buildAssertions";

describe("rollup SSR build", () => {
    it("dist/client/index.html has <script>, dist/server/server.cjs render() returns SSR_MARKER", async () => {
        await assertSsrBuild("rollup");
    }, 180_000);
});
