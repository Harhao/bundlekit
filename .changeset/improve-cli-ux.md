---
"@bundlekit/cli": minor
---

**BREAKING (cjs entry removal)**: `@bundlekit/cli` is now ESM-only.

- Bin entries (`bundlekit-cli`, `dc`) both point to `dist/index.mjs`.
- The previous `dist/index.cjs` build is removed; users invoking the cli must use Node ≥ 18 with ESM support (already the project requirement).
- New ink-based interactive UI for `create` and `add` commands in TTY terminals: gradient banner, step-based prompts, animated task list, and final success view. Behavior is functionally equivalent to the previous flow.
- Non-TTY environments (CI / piped) and `DEVKIT_NO_INK=1` automatically fall back to the legacy enquirer + Logger flow, no breaking change for scripted use.
- `Creator` class is now a thin wrapper around pure action functions in `lib/commands/create/actions.ts` shared between the ink and fallback paths.
- New `lib/ui/` directory with reusable components: `Banner`, `StepFrame`, `Select`, `TextInput`, `TaskList`, `Done`, `ErrorView`, plus `CreateApp` / `AddApp` state machines.

Migration: Windows users on legacy `cmd.exe` may see degraded output — recommend Windows Terminal / iTerm2. CI users add `DEVKIT_NO_INK=1` to env if needed (auto-detected by default).
