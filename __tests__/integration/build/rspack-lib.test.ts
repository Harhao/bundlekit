import { describe, it } from "vitest";
import { assertLibraryBuild } from "../helpers/buildAssertions";

describe("rspack library build", () => {
    it("dist/*.cjs requireable + exports add(2,3)===5", async () => {
        await assertLibraryBuild("rspack");
    }, 180_000);
});
