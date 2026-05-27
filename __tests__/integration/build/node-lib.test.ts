import { describe, it } from "vitest";
import { assertLibraryBuild } from "../helpers/buildAssertions";

describe("node plugin library build (rollup)", () => {
    it("dist/*.cjs requireable + exports add(2,3)===5 and __DEVKIT_LIB_MARKER__", async () => {
        await assertLibraryBuild("node");
    }, 120_000);
});
