---
"bundlekit-cli-docs": patch
"@bundlekit/docs-agent": patch
---

docs: 更新文档以反映 Parcel 2 与 esbuild 适配器的加入，七种打包器全覆盖

- `docs/index.md`：hero description 与 SSR 特性说明从"五种"更新为"七种"
- `docs/guide.md`：快速开始介绍从五种更新为七种，bundler 选择列表加入 parcel/esbuild，SSR 章节同步更新
- `docs/guide/bundlers.md`：打包器列表加入 Parcel 2 与 esbuild 行；各打包器特性新增 Parcel/esbuild 章节；配置字段映射表扩展至七列；SSR 支持矩阵加入 parcel/esbuild 行
- `docs/guide/ssr.md`：bundler 数量更新为七个；HMR 支持矩阵加入 parcel/esbuild 行及说明
- `packages/bundlekit-docs/README.md`：更新标题与简介
- `packages/bundlekit-docs-agent/README.md`：intro 注明覆盖七种打包器
