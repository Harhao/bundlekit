## Design: Bundler Adapters

### Rollup Adapter

- Config: `input` from entry, `output.dir` + `output.format: "umd"` from outDir
- Plugins: `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`, `@rollup/plugin-typescript`, `@rollup/plugin-babel`
- Prod: `rollup.rollup()` → `bundle.write()` to produce output
- Dev: `rollup.watch()` with console logging for errors and rebuilds

### Rspack Adapter

- Config: mirror webpack adapter pattern (entry, output, resolve, module.rules, plugins)
- Module: `builtin:swc-loader` for ts/tsx, asset modules for images/fonts
- Plugins: `rspack.DefinePlugin`, `rspack.HtmlRspackPlugin`
- devServer: from `IBuildConfig.devServer` (host, port, proxy, hot)
