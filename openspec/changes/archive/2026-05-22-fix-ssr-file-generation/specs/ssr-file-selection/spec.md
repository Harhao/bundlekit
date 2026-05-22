## ADDED Requirements

### Requirement: SSR-conditional file generation
The template generator SHALL include or exclude files based on the `ssr` context variable. Files are divided into three categories: SSR-only (entry-client, entry-server), CSR-only (index, main), and shared (App, components, config).

#### Scenario: Non-SSR mode excludes SSR entries
- **WHEN** `ssr` context is `false`
- **THEN** files containing `entry-client` in their name SHALL NOT be generated
- **AND** files containing `entry-server` in their name SHALL NOT be generated

#### Scenario: SSR mode excludes CSR entry
- **WHEN** `ssr` context is `true`
- **THEN** files named `index.tsx`, `index.jsx`, `main.ts`, or `main.js` SHALL NOT be generated

#### Scenario: Shared files always generated
- **WHEN** `ssr` is either `true` or `false`
- **THEN** files named `App.tsx`, `App.jsx`, `App.vue`, or any file not in the SSR-only or CSR-only categories SHALL be generated regardless of the `ssr` value

### Requirement: SSR selection in interactive create
The `create` command SHALL prompt the user to select whether to enable SSR when the `--ssr` flag is not provided. The default SHALL be `false` (CSR mode).

#### Scenario: Interactive SSR prompt in TTY
- **WHEN** user runs `bundlekit-cli create my-app` in a TTY without `--ssr`
- **THEN** the cli SHALL display an SSR selection step with "是 — 启用 SSR" and "否 — 纯客户端渲染（推荐）" options
- **AND** the default selection SHALL be "否"

#### Scenario: --ssr flag bypasses prompt
- **WHEN** user runs `bundlekit-cli create my-app --ssr`
- **THEN** the cli SHALL skip the SSR prompt and enable SSR

#### Scenario: --no-ssr flag bypasses prompt
- **WHEN** user runs `bundlekit-cli create my-app --no-ssr`
- **THEN** the cli SHALL skip the SSR prompt and disable SSR
