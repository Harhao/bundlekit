---
"@bundlekit/service": patch
---

fix: 修复安装 bundler 插件后仍无法加载的问题

- `loadBundlerPlugin` 改用用户项目目录（`this.context`）作为 `createRequire` 基准路径
  - 原来以 `import.meta.url`（service 包自身位置）为基准，全局安装时无法找到用户项目中新安装的包
- ESM 兜底改用 `pathToFileURL(resolvedPath).href` 替换 bare specifier
  - 原来 `import(packageName)` 仍从 service 文件位置解析，与安装路径无关
- 新增实际错误信息打印，方便排查加载失败原因
