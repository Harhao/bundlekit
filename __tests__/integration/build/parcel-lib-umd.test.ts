import { describe, it } from "vitest";
import { assertLibraryUMDBuild } from "../helpers/buildAssertions";

// Parcel 原生不支持 UMD outputFormat（只有 'commonjs' / 'global' / 'esmodule'），
// 也不支持 libraryName 注入。本用例 skip，等 parcel 适配器后续实现 UMD wrapper
// （类似 esbuild 的 banner/footer 思路）后再开启。
describe.skip("parcel library UMD build", () => {
    it("产物含 libraryName=MyLib 且 vm eval 后 globalThis.MyLib.add(2,3)===5", async () => {
        await assertLibraryUMDBuild("parcel");
    }, 180_000);
});
