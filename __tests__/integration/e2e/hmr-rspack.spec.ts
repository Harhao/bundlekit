import { test } from "@playwright/test";
import { assertClientHMR } from "../helpers/hmr";

// rspack HMR via SSR middleware 仍有依赖（rspack-dev-server 无原生 middleware mode），暂跳过
test.skip("rspack client HMR updates without page reload", async ({ page }) => {
    await assertClientHMR("rspack", page);
});
