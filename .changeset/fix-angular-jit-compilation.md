---
"@bundlekit/bundler-vite": patch
---

fix: 修复 Angular 17+ JIT 编译失败问题

添加 `optimizeDeps.exclude` 配置，排除 Angular 核心包的 Vite 依赖预打包，
避免 `_PlatformNavigation` 等服务因部分编译格式导致 JIT 编译错误。
