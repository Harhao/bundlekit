## 1. plugin-react / plugin-vue generator silenced

- [x] 1.1 在 `packages/devkit-plugin-react/generator/index.ts` 加 `shouldSkipPrompt()` helper（检测 `!process.stdout.isTTY` / `DEVKIT_NO_PROMPT === "1"` / `CI === "true"|"1"`）
- [x] 1.2 同文件 prompt 之前判断：`if (shouldSkipPrompt()) return;`
- [x] 1.3 prompt 渲染前加 `console.log("\n")` + 颜色分隔符，让真 TTY 下文案醒目
- [x] 1.4 把 `api.addDependency("@devkit/request", "^1.0.0")` 改为 `"workspace:^"`
- [x] 1.5 `packages/devkit-plugin-vue/generator/index.ts` 同款改造
- [x] 1.6 plugin-react / plugin-vue 各加 1 个单测：环境变量设置后 prompt 不被调用（vitest mock api.prompt）

## 2. cli 在 ink 路径注入 DEVKIT_NO_PROMPT

- [x] 2.1 `CreateApp.tsx`：在调 `runGenerator` 之前 save+set `process.env.DEVKIT_NO_PROMPT = "1"`，调用结束后 restore
- [x] 2.2 `creator.ts`（legacy 路径）：相同处理（legacy 路径 isTTY 但走 enquirer 主流程，generator 不应另起 prompt 抢 stdin）
- [x] 2.3 `add` 命令路径**不**注入（`dc add react` 应保留交互能力）—— 验证 `index.tsx` 的 add 命令处理符合预期

## 3. normalizeDeps 二次调用

- [x] 3.1 `actions.ts`：在 `runGenerator` 完成后调一次 `normalizeProjectDeps(targetDir, depMode)`，再触发 `installDeps`（如果 hasPendingDeps）
- [x] 3.2 `creator.ts` legacy 路径同款
- [x] 3.3 `CreateApp.tsx` task 链改为：`render → normalize → deps → install → generator → normalize-after-gen → install-pending`
- [x] 3.4 单测：generator 写 `workspace:^` 后调用 normalizeDeps 替换正确（mock fs）

## 4. PackageManager 加 --ignore-workspace 检测

- [x] 4.1 `packages/devkit-shared-utils/lib/shared/pkgManager.ts` 新增 `findEnclosingPnpmWorkspace(cwd): { root, packages } | null`
- [x] 4.2 同文件新增 `isWorkspaceMember(workspaceRoot, cwd, packagesGlobs): boolean`（用 minimatch 或简单 glob）
- [x] 4.3 `runCommand` / `install` / `add` 在 pnpm + 非 member 场景追加 `--ignore-workspace`
- [x] 4.4 单测 `__tests__/pkgManagerWorkspace.test.ts`：4 个判定场景（member / 非 member / 全外 / 非 pnpm）

## 5. setBinaryMirrors 静默 + 超时

- [x] 5.1 `setBinaryMirrors` 的 try/catch 替换 `console.error(e)` 为 `this.logger.debug?.(...)`
- [x] 5.2 `getMetadata('binary-mirror-config')` 的请求加 5s 超时（用 AbortSignal.timeout）
- [x] 5.3 Logger 类同步加 `debug(msg, tag?)` 方法（DEVKIT_DEBUG=1 时输出，否则 noop）
- [x] 5.4 单测：mock spawn / fetch 验证 stderr 不含 ERR_INVALID_PROTOCOL

## 6. 集成测试

- [x] 6.1 `__tests__/integration/cli/cli-create-prompts.test.ts` 新建：DEVKIT_NO_PROMPT=1 跑完整 create，断言 generator 跳过 prompt + package.json 不含 `@devkit/request`
- [x] 6.2 同文件加 case：CI=true 同款验证
- [x] 6.3 现有 `cli-create.test.ts` 加断言：生成 `package.json` 不含 `^1.0.0` 字面量（防御 generator 留死硬编码）
- [x] 6.4 跑 `pnpm test` + `pnpm test:integration` 全过

## 7. changeset

- [x] 7.1 写 `.changeset/fix-create-flow-prompts.md`，标记所有受影响包（`@devkit/cli` / `@devkit/plugin-react` / `@devkit/plugin-vue` / `@devkit/shared-utils`）为 patch

## 8. 验证 / 回归

- [x] 8.1 真终端跑 `pnpm debug`：完整流程秒级跑完，无 prompt 卡顿、无 binary-mirror noise、无 ^1.0.0 残留
- [x] 8.2 真终端跑 `dc add request`（无 cli create context）：仍能正常弹 prompt 并装包（保留交互能力验证）
- [x] 8.3 跑 monorepo 外的 cli create（DEVKIT_DEP_MODE=npm）：normalizeDeps 二次调用替换 generator 的 workspace:^ 为 ^cliVersion
- [x] 8.4 `openspec validate fix-create-flow-prompts --strict` 通过
