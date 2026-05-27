import { describe, it } from "vitest";
import { assertSsrBuild } from "../helpers/buildAssertions";

describe("esbuild SSR build", () => {
    it("dist/client/index.html has <script>, dist/server/server.cjs render() returns SSR_MARKER", async () => {
        await assertSsrBuild("esbuild");
    }, 180_000);
});
