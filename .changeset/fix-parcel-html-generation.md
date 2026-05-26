---
"@bundlekit/bundler-parcel": patch
---

fix: 修复 Parcel 适配器 dev/build 不生成 HTML 导致页面空白的问题

- 新增 `writeHtmlFile()` 函数，构建完成后扫描 outDir 中的 JS/CSS 产物并写入 `index.html`
- 若配置了 `pages[0].template` 则读取模板注入 script/link 标签，否则自动生成最小 HTML（含 `<div id="root">`)
- `devBuild()`：每次 Parcel watch 构建成功后调用，再启动/reload DevServer，确保首次访问即有 HTML
- `prodBuild()`：`bundler.run()` 完成后调用，保证生产产物包含 `index.html`
