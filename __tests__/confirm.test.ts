import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { confirm } from "../packages/devkit-shared-utils/lib/shared/confirm";

describe("confirm", () => {
    let originalIsTTY: any;
    let originalStdinIsTTY: any;
    let originalNoPrompt: string | undefined;

    beforeEach(() => {
        originalIsTTY = (process.stdout as any).isTTY;
        originalStdinIsTTY = (process.stdin as any).isTTY;
        originalNoPrompt = process.env.DEVKIT_NO_PROMPT;
    });

    afterEach(() => {
        (process.stdout as any).isTTY = originalIsTTY;
        (process.stdin as any).isTTY = originalStdinIsTTY;
        if (originalNoPrompt === undefined) {
            delete process.env.DEVKIT_NO_PROMPT;
        } else {
            process.env.DEVKIT_NO_PROMPT = originalNoPrompt;
        }
        vi.restoreAllMocks();
    });

    it("non-TTY returns default false", async () => {
        (process.stdout as any).isTTY = false;
        (process.stdin as any).isTTY = false;
        const result = await confirm({ message: "ok?" });
        expect(result).toBe(false);
    });

    it("non-TTY returns provided default true", async () => {
        (process.stdout as any).isTTY = false;
        (process.stdin as any).isTTY = false;
        const result = await confirm({ message: "ok?", default: true });
        expect(result).toBe(true);
    });

    it("DEVKIT_NO_PROMPT=1 short-circuits even in TTY", async () => {
        (process.stdout as any).isTTY = true;
        (process.stdin as any).isTTY = true;
        process.env.DEVKIT_NO_PROMPT = "1";
        const result = await confirm({ message: "ok?", default: true });
        expect(result).toBe(true);
    });

    it("non-TTY default=false", async () => {
        (process.stdout as any).isTTY = false;
        (process.stdin as any).isTTY = false;
        const result = await confirm({ message: "skip?", default: false });
        expect(result).toBe(false);
    });
});
