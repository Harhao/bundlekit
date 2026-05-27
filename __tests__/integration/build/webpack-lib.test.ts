import { describe, it } from "vitest";
import { assertLibraryBuild } from "../helpers/buildAssertions";

describe("webpack library build", () => {
    it("dist/*.cjs requireable + exports add(2,3)===5", async () => {
        await assertLibraryBuild("webpack");
    }, 180_000);
});
