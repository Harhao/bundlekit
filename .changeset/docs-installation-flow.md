---
"@bundlekit/service": patch
---

Documentation overhaul to reflect cli-first onboarding flow and decoupled bundler installation.

- Rewrites `docs/index.md` Hero + Quick Start to lead with `npx @bundlekit/cli create my-app`.
- Rewrites `docs/guide.md` with two integration paths (scaffold-first / manual-integration), plus a global install option.
- Updates `docs/guide/cli.md` with bundler short-name table for `dc add`, runtime missing-bundler prompt behavior, and ink UI / fallback notes.
- Adds `tools` (escape hatch) section with 5-bundler examples to `docs/guide/config.md`.
- Adds `ssr` field documentation to `docs/guide/config.md`.
- New `docs/guide/ssr.md` complete SSR guide (architecture diagram, entry conventions, HMR matrix, common errors).
- Updates `docs/guide/bundlers.md` "Bundler 安装方式" + SSR support matrix.
- Updates `docs/guide/architecture.md` dependency diagram (service no longer arrows to bundler-*) and runtime loader description (find-or-prompt-or-fail).
- Updates `README.md` install sections (CN + EN) to match.
