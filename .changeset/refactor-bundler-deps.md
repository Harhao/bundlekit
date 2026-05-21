---
"@devkit/service": minor
"@devkit/cli": minor
"@devkit/shared-utils": minor
---

**BREAKING**: Decouple bundler adapters from `@devkit/service` runtime dependencies.

- `@devkit/service` no longer lists `@devkit/bundler-*` packages in `dependencies`. They are now declared as optional `peerDependencies`.
- `@devkit/cli create` writes the chosen `@devkit/bundler-{name}` to the new project's `devDependencies` automatically.
- `@devkit/cli add` accepts bundler short names (`vite`, `webpack`, `rspack`, `rollup`, `rolldown`), `bundler-<name>`, or full package names; bundlers are installed as `devDependencies`.
- `@devkit/service` runtime: when a bundler adapter is not installed, the system now prompts the user (TTY) or fails with guidance (non-TTY); `noSave` transient install path is removed. New environment variables: `DEVKIT_NO_PROMPT=1` to suppress prompts in TTY, `DEVKIT_AUTO_INSTALL=1` to auto-install in CI.
- `@devkit/shared-utils` adds `confirm()` helper and `BUNDLER_PACKAGE_MAP` / `resolveBundlerName()` / `resolveBundlerPackage()` utilities.

Migration: existing projects upgrading need to either add their chosen bundler to `devDependencies` (recommended), or accept the runtime install prompt the first time `devkit-service` runs.
