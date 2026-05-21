import { test } from "@playwright/test";
import { assertClientHMR } from "../helpers/hmr";

test("vite client HMR updates without page reload", async ({ page }) => {
    await assertClientHMR("vite", page);
});
