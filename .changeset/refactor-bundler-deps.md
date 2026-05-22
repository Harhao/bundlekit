---
"@bundlekit/service": minor
"@bundlekit/cli": minor
"@bundlekit/shared-utils": minor
---

**BREAKING**: Decouple bundler adapters from `@bundlekit/service` runtime dependencies.

- `@bundlekit/service` no longer lists `@bundlekit/bundler-*` packages in `dependencies`. They are now declared as optional `peerDependencies`.
- `@bundlekit/cli create` writes the chosen `@bundlekit/bundler-{name}` to the new project's `devDependencies` automatically.
- `@bundlekit/cli add` accepts bundler short names (`vite`, `webpack`, `rspack`, `rollup`, `rolldown`), `bundler-<name>`, or full package names; bundlers are installed as `devDependencies`.
- `@bundlekit/service` runtime: when a bundler adapter is not installed, the system now prompts the user (TTY) or fails with guidance (non-TTY); `noSave` transient install path is removed. New environment variables: `DEVKIT_NO_PROMPT=1` to suppress prompts in TTY, `DEVKIT_AUTO_INSTALL=1` to auto-install in CI.
- `@bundlekit/shared-utils` adds `confirm()` helper and `BUNDLER_PACKAGE_MAP` / `resolveBundlerName()` / `resolveBundlerPackage()` utilities.

Migration: existing projects upgrading need to either add their chosen bundler to `devDependencies` (recommended), or accept the runtime install prompt the first time `bundlekit-service` runs.
