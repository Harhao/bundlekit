## Context

The `create` command in bundlekit-cli generates project files from templates. SSR support is controlled by a `--ssr` CLI flag that defaults to `false`. The generator in `lib/generator/index.ts` has a `processDir` method that iterates template files and applies conditional filtering.

Currently, only `entry-server` files are filtered when `ssr=false`. The `entry-client` files are always generated regardless of the SSR setting. In the Ink interactive UI, there is no step asking users about SSR — it can only be enabled via the `--ssr` flag.

Template structure for each framework (react-ts shown):

```
src/
  index.tsx.ejs       ← CSR entry (only when ssr=false)
  entry-client.tsx.ejs ← SSR client entry (only when ssr=true)
  entry-server.tsx.ejs ← SSR server entry (only when ssr=true)
  App.tsx.ejs          ← always generated
```

## Goals / Non-Goals

**Goals:**
- Fix generator to filter `entry-client` files when `ssr=false`
- Filter CSR-only entry (`index.tsx`/`main.ts`) when `ssr=true`
- Add interactive SSR selection step in Ink UI (between bundler and pm)
- Add SSR prompt in legacy (non-TTY) path
- Update step count from 4 to 5

**Non-Goals:**
- Changing the `.bundlekitrc` EJS conditional logic (already correct)
- Modifying bundler plugin SSR runtime behavior
- Changing the `--ssr` CLI flag semantics

## Decisions

### D1: Filter logic in generator

**Decision:** Use the same `String.includes()` pattern already in use, but expand the condition.

Current code (line 37):
```ts
if (!this.context.ssr && entry.name.includes('entry-server')) continue;
```

New code:
```ts
if (!this.context.ssr && (entry.name.includes('entry-server') || entry.name.includes('entry-client'))) continue;
if (this.context.ssr && (entry.name === 'index.tsx' || entry.name === 'index.jsx' || entry.name === 'main.ts' || entry.name === 'main.js')) continue;
```

**Rationale:** Minimal change, follows existing pattern. The CSR entries have fixed names (`index.tsx`, `index.jsx`, `main.ts`, `main.js`) across all templates, so exact match is safe and more precise than `includes()`.

**Alternative considered:** Use a manifest/config to declare file-sets per mode. Rejected as over-engineering for 4 templates.

### D2: SSR step position in Ink UI

**Decision:** Place SSR selection as step 3 (after bundler, before pm). Total steps: 5.

```
Step 1/5 · 模板
Step 2/5 · 打包器
Step 3/5 · SSR
Step 4/5 · 包管理器
Step 5/5 · 项目描述
```

**Rationale:** SSR is a project architecture choice that affects file generation, so it belongs early — before dependency installation. Placing it after bundler makes logical sense (you pick the build tool, then decide if you need SSR).

### D3: SSR selection UI component

**Decision:** Use a Yes/No select input with two options:
- `是 — 启用 SSR（需要服务端渲染）`
- `否 — 纯客户端渲染（推荐）`

Default to "否" (no SSR).

**Rationale:** SSR is an advanced feature most users don't need. Defaulting to no keeps the common path simple.

### D4: Legacy path SSR prompt

**Decision:** In `legacyCreate()`, add an enquirer prompt for SSR when `--ssr` is not provided.

**Rationale:** Parity with the Ink UI path. The `--ssr` flag still bypasses the prompt.

## Risks / Trade-offs

- **[Risk] Breaking existing integration tests** → Tests assert file presence/absence. The 4 existing SSR tests in `cli-create.test.ts` will need updating since `entry-client` will now be filtered in non-SSR mode.
- **[Risk] Step count change breaks user expectations** → The `cli-ink-ui` spec says "Step 1/4". Updating to 5 steps is a spec-level change. Mitigated by updating the spec.
- **[Trade-off] Exact match vs pattern match for CSR entries** → Using exact filenames (`index.tsx`, `main.ts`) is less flexible but more predictable. If a future template uses a different CSR entry name, the filter won't catch it. Acceptable since we control all templates.
