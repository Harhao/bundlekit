import { describe, it } from "vitest";
import { assertNodeBuild } from "../helpers/buildSmoke";
import { lookupKnownFailure } from "../helpers/knownFailures";

const BUNDLERS = ["webpack", "vite", "rspack", "rollup", "rolldown", "parcel", "esbuild"] as const;
const TEMPLATE = "node-ts";

/**
 * node-ts 模板 × 7 bundler 的 build smoke。
 *
 * 与 dev-smoke 的区别：
 *   - node-ts 没有 dev server（target=node 是库 / 服务），不能 GET /
 *   - 改测「build → main 字段 → import 加载」，验证产物文件名与 package.json 一致
 *
 * 这一套能直接回归 Issue 2（chunk 名 'app' vs main 'index.js' 错位）。
 */
describe(`build-smoke: ${TEMPLATE} × 7 bundler`, () => {
    for (const bundler of BUNDLERS) {
        const known = lookupKnownFailure({ template: TEMPLATE, bundler, mode: "build" });
        const name = `${TEMPLATE} × ${bundler} · build → main 文件存在 + 可 import`;
        const fn = async () => {
            await assertNodeBuild({ bundler });
        };
        if (known) {
            it.skip(`${name}（已知失败：${known}）`, fn, 180_000);
        } else {
            it(name, fn, 180_000);
        }
    }
});
