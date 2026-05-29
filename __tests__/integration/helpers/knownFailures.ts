/**
 * dev/SSR/build smoke 测试矩阵中的已知失败组合。
 *
 * 这些组合在「真实模板 → install → dev/build → fetch」端到端流程下确实跑不通，
 * 但失败原因不是当前 4 个修复点引入的，是各自 bundler 适配器的旧问题：
 *
 * 1. webpack + SSR 模式：dev SSR 中间件没把 `<!--ssr-outlet-->` 替换为渲染结果
 *    （body 仍含原始 placeholder，第一个请求未走 SSR render 路径）
 *
 * 2. rspack + SSR 模式：dev server history-fallback 把 /entry-client.js
 *    错误回退成 HTML，client bundle 路由命中了 HTML
 *
 * 3. vite / rollup / rolldown / esbuild + node-ts 非 SSR：bundler 适配器把
 *    `target=node` 识别为 SSR server pass，强行输出 `server.cjs` 而非
 *    模板声明的 `index.js`，导致 package.json main 字段对不上产物
 *
 * 4. esbuild + vue3 SSR：esbuild-plugin-vue3 + SSR 渲染路径未集成
 *
 * 移除条件：上游 bundler 适配器修复后，从此清单移除对应组合，对应测试自动转为
 * 必跑用例；若发现新组合失败，先放进这里 + GitHub issue 跟进，再移除。
 */
export interface IFailureKey {
    template: string;
    bundler: string;
    /** "csr" | "ssr" | "build" */
    mode: "csr" | "ssr" | "build";
}

const REGISTRY: ReadonlyArray<IFailureKey & { reason: string }> = [
    // 本轮已修复的所有 14 个组合：
    //   1) [已修复] webpack SSR：placeholder 未被替换
    //      → bundler-webpack/src/index.ts 的 makeSSRPageRouter（把 SSR handler
    //        放在 dev-middleware 之前，并按 URL 是否为资源做路由分流）
    //   2) [已修复] rspack SSR：bundle 路由 fallback 到 HTML
    //      → bundler-rspack 改用 webpack-dev-middleware（替代 RspackDevServer
    //        .app.callback() 的 hack），并加 makeSSRPageRouter
    //   3) [已修复] node-ts × {vite,rollup,rolldown,esbuild} 非 SSR
    //      → buildSSRView 注入 __isServerPass=true 标记，各 bundler 适配器
    //        改用此标记区分 SSR pass / Node 库
    //   4) [已修复] esbuild + vue3 SSR
    //      → bundler-esbuild 把 frameworkPlugins 提到 isServerPass 分支前，
    //        让 server pass 也带上 esbuild-plugin-vue3
    //
    // 任何新增已知失败组合按下面格式登记，便于后续按图索骥修复：
    //
    //   { template: "...", bundler: "...", mode: "csr"|"ssr"|"build",
    //     reason: "<根因 + GitHub issue 链接>" },
];

/**
 * 返回 (template, bundler, mode) 的已知失败原因，未命中时返回 null。
 *
 * 用法：
 *   ```ts
 *   const known = lookupKnownFailure({ template, bundler, mode: "ssr" });
 *   if (known) {
 *     it.skip(`...（已知失败：${known}）`, ...);
 *   } else {
 *     it(`...`, ...);
 *   }
 *   ```
 */
export function lookupKnownFailure(key: IFailureKey): string | null {
    const found = REGISTRY.find(
        (r) => r.template === key.template && r.bundler === key.bundler && r.mode === key.mode,
    );
    return found?.reason ?? null;
}
