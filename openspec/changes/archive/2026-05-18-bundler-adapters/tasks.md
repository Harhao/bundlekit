## 1. Rollup Adapter

- [x] 1.1 Complete `getFormatrollupConfg()`: add output (UMD format, outDir), resolve (extensions, aliases)
- [x] 1.2 Add standard Rollup plugins: node-resolve, commonjs, typescript, babel
- [x] 1.3 Fix production `run()`: call `bundle.write()` after `rollup.rollup()`
- [x] 1.4 Complete watch mode with proper error/rebuild logging

## 2. Rspack Adapter

- [x] 2.1 Complete `getFormatrspackConfg()`: add output, resolve, module.rules, plugins
- [x] 2.2 Add `DefinePlugin` and `HtmlRspackPlugin` to plugins
- [x] 2.3 Configure devServer from `IBuildConfig.devServer` (host, port, proxy, hot)
- [x] 2.4 Configure `builtin:swc-loader` for TypeScript processing

## 3. Verification

- [x] 3.1 Run `pnpm build` for both packages
- [x] 3.2 Verify rollup and rspack can build/serve in dev mode
