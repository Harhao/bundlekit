import { describe, it } from "vitest";
import { assertDevSmoke } from "../helpers/devSmoke";
import { lookupKnownFailure } from "../helpers/knownFailures";

const BUNDLERS = ["webpack", "vite", "rspack", "rollup", "rolldown", "parcel", "esbuild"] as const;
const TEMPLATE = "angular-js";

describe(`dev-smoke: ${TEMPLATE} × 7 bundler`, () => {
    describe("CSR (dev mode)", () => {
        for (const bundler of BUNDLERS) {
            const known = lookupKnownFailure({ template: TEMPLATE, bundler, mode: "csr" });
            const name = `${TEMPLATE} × ${bundler} · GET / 返回 HTML + 入口 + bundle 可下载`;
            const fn = async () => {
                await assertDevSmoke({ template: TEMPLATE, bundler, ssr: false });
            };
            if (known) {
                it.skip(`${name}（已知失败：${known}）`, fn, 120_000);
            } else {
                it(name, fn, 120_000);
            }
        }
    });

    describe("SSR (dev mode)", () => {
        for (const bundler of BUNDLERS) {
            const known = lookupKnownFailure({ template: TEMPLATE, bundler, mode: "ssr" });
            const name = `${TEMPLATE} × ${bundler} · SSR body 含 "Hello, demo-smoke!"`;
            const fn = async () => {
                await assertDevSmoke({ template: TEMPLATE, bundler, ssr: true });
            };
            if (known) {
                it.skip(`${name}（已知失败：${known}）`, fn, 120_000);
            } else {
                it(name, fn, 120_000);
            }
        }
    });
});
