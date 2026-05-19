import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["__tests__/**/*.test.ts"],
    },
    resolve: {
        alias: {
            "@devkit/shared-utils": path.resolve(__dirname, "packages/devkit-shared-utils/index.ts"),
        },
    },
});
