import { describe, it } from "vitest";
import { assertSsrBuild } from "../helpers/buildAssertions";

describe("rolldown SSR build", () => {
    it("dist/client/index.html has <script>, dist/server/server.cjs render() returns SSR_MARKER", async () => {
        await assertSsrBuild("rolldown");
    }, 180_000);
});
