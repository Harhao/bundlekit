import { describe, it } from "vitest";
import { assertLibraryUMDBuild } from "../helpers/buildAssertions";

describe("rspack library UMD build", () => {
    it("产物含 libraryName=MyLib 且 vm eval 后 globalThis.MyLib.add(2,3)===5", async () => {
        await assertLibraryUMDBuild("rspack");
    }, 180_000);
});
