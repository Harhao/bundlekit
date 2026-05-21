import { test } from "@playwright/test";
import { assertClientHMR } from "../helpers/hmr";

// webpack HMR 在 SSR middleware 路径下依赖 React Fast Refresh 集成（fixture 未装 react-refresh-webpack-plugin），
// dev SSR HTTP 已在 dev-ssr/webpack-curl.test.ts 验证可用。HMR e2e 待后续单独投入
test.skip("webpack client HMR updates without page reload", async ({ page }) => {
    await assertClientHMR("webpack", page);
});
