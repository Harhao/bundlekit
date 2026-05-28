---
"@bundlekit/plugin-react": patch
"@bundlekit/plugin-vue": patch
---

修复 `@bundlekit/plugin-react@0.0.10` 与 `@bundlekit/plugin-vue@0.0.10` 误删 `template-react-ts/` 和 `template-vue3-ts/` 模板目录，导致 `npx @bundlekit/cli@latest create <name>` 选择 `react-ts` / `vue3-ts` 时报 `模板 "xxx" 未找到` 的问题。本次发布把两个 TS 模板目录补回包内。
