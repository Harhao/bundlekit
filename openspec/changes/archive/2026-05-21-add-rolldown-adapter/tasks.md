## 1. Package Setup

- [x] 1.1 Create `@devkit/bundler-rolldown` package with `package.json`, `tsconfig.json`, rollup build scripts
- [x] 1.2 Add `rolldown` dependency and `@devkit/shared-utils` workspace dependency
- [x] 1.3 Set up `rollup:build` script mirroring other bundler adapters

## 2. Rolldown Adapter Implementation

- [x] 2.1 Implement `RolldownBundler` class with `IBuildToolAdapter` interface
- [x] 2.2 Implement `transformConfig()`: map `IBuildConfig` entry/output/resolve/alias to `RolldownOptions`
- [x] 2.3 Implement `getFormatRolldownConfig()`: build full Rolldown config with built-in TypeScript/JSX transforms
- [x] 2.4 Implement `run()`: dispatch `rolldown.watch()` for dev, `rolldown.build()` for prod
- [x] 2.5 Implement `validateConfig()`: return true (rely on Rolldown's own validation)

## 3. Service Integration

- [x] 3.1 Add `rolldown` to bundler map in `@devkit/service`
- [x] 3.2 Add `@devkit/bundler-rolldown` as workspace dependency of `@devkit/service`
- [x] 4.1 Add `rolldown:dev` and `rolldown:prod` scripts to `exmaple/package.json`
- [x] 4.2 Add `@devkit/bundler-rolldown` as devDependency of `exmaple`

## 5. Verification

- [x] 5.1 `pnpm install` to link all dependencies
- [x] 5.2 `pnpm --filter @devkit/bundler-rolldown run rollup:build` succeeds
- [x] 5.3 `pnpm --filter exmaple run rolldown:dev` starts dev server
- [x] 5.4 `pnpm --filter exmaple run rolldown:prod` produces output
