# code-quality Specification

## Purpose
TBD - created by archiving change add-release-toolchain. Update Purpose after archive.
## Requirements
### Requirement: 根目录 ESLint flat config 覆盖所有 packages 的 TS 文件
系统 SHALL 在根目录提供 `eslint.config.mjs`，规则基于 `@typescript-eslint/recommended`，覆盖路径 `packages/**/*.{ts,tsx}`，忽略 `**/dist/**`、`**/node_modules/**`。

#### Scenario: 根目录运行 eslint 可扫描 packages 下的 TS 文件
- **WHEN** 在根目录运行 `pnpm lint`
- **THEN** ESLint 扫描 `packages/**/*.{ts,tsx}` 并输出结果，退出码 0（无 error 时）

#### Scenario: dist 目录被忽略
- **WHEN** 运行 `pnpm lint`
- **THEN** `packages/*/dist/` 下的文件不被 lint

### Requirement: 根目录 Prettier 配置统一格式规则
系统 SHALL 在根目录提供 `.prettierrc`，配置：单引号、2空格缩进、trailing comma `all`、print width 100。`.prettierignore` 排除 `dist/`、`node_modules/`、`*.md`（不强制格式化文档）。

#### Scenario: 运行 prettier 格式化 TS 文件符合约定
- **WHEN** 运行 `prettier --check packages/bundlekit-cli/index.ts`
- **THEN** 如文件符合配置规则则退出码为 0

#### Scenario: 与 ESLint 格式规则无冲突
- **WHEN** 同时运行 eslint 和 prettier 检查同一文件
- **THEN** 两者无互相冲突的 error（eslint-config-prettier 已关闭冲突规则）

### Requirement: 根目录 package.json 提供 lint 和 format 脚本
系统 SHALL 在根目录 `package.json` 的 `scripts` 中包含：
- `lint`：运行 `eslint packages --ext ts,tsx`
- `format`：运行 `prettier --write "packages/**/*.{ts,tsx,js,json}"`

#### Scenario: pnpm lint 可执行
- **WHEN** 运行 `pnpm lint`
- **THEN** 命令找到 ESLint 并执行，无 "command not found" 错误

