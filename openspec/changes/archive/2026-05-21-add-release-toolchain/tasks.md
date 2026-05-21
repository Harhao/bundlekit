## 1. Husky + commitlint（Commit 规范门禁）

- [x] 1.1 安装 `husky`、`@commitlint/cli`、`@commitlint/config-conventional` 到根目录 devDependencies
- [x] 1.2 在根目录 `package.json` 的 `scripts` 中添加 `"prepare": "husky"` 脚本
- [x] 1.3 运行 `pnpm husky init` 初始化 `.husky/` 目录
- [x] 1.4 创建 `.husky/commit-msg` 文件，内容为 `pnpm dlx commitlint --edit $1`
- [x] 1.5 创建 `commitlint.config.mjs`，继承 `@commitlint/config-conventional`，覆盖 `subject-case: [0]`、`subject-full-stop: [0]`，设置 `subject-min-length: [2, 'always', 2]`

## 2. lint-staged + Husky pre-commit（暂存文件质量门禁）

- [ ] 2.1 安装 `lint-staged` 到根目录 devDependencies
- [ ] 2.2 创建 `.husky/pre-commit` 文件，内容为 `pnpm lint-staged`
- [ ] 2.3 在根目录 `package.json` 中添加 `lint-staged` 配置字段：`*.{ts,tsx}` 跑 `eslint --fix` 和 `prettier --write`，`*.{js,json,md}` 跑 `prettier --write`

## 3. ESLint flat config（代码质量规则）

- [ ] 3.1 安装 `eslint`、`@typescript-eslint/eslint-plugin`、`@typescript-eslint/parser`、`eslint-config-prettier` 到根目录 devDependencies
- [ ] 3.2 创建根目录 `eslint.config.mjs`，配置 `@typescript-eslint/recommended` 规则，覆盖 `packages/**/*.{ts,tsx}`，ignores 包含 `**/dist/**`、`**/node_modules/**`
- [ ] 3.3 在根目录 `package.json` scripts 中添加 `"lint": "eslint packages --ext .ts,.tsx"`

## 4. Prettier 格式化配置

- [ ] 4.1 安装 `prettier` 到根目录 devDependencies
- [ ] 4.2 创建根目录 `.prettierrc`，配置：`singleQuote: true`、`tabWidth: 2`、`trailingComma: "all"`、`printWidth: 100`、`semi: false`
- [ ] 4.3 创建根目录 `.prettierignore`，排除 `dist/`、`node_modules/`、`pnpm-lock.yaml`
- [ ] 4.4 在根目录 `package.json` scripts 中添加 `"format": "prettier --write \"packages/**/*.{ts,tsx,js,json}\""`

## 5. Changesets 版本管理配置

- [ ] 5.1 安装 `@changesets/cli` 到根目录 devDependencies
- [ ] 5.2 运行 `pnpm changeset init` 生成 `.changeset/config.json`
- [ ] 5.3 修改 `.changeset/config.json`：设置 `access: "restricted"`、`baseBranch: "main"`、`updateInternalDependencies: "patch"`、`linked: []`
- [ ] 5.4 在根目录 `package.json` scripts 中添加 `"changeset": "changeset"` 和 `"version-packages": "changeset version"`

## 6. GitHub Actions — CI workflow

- [ ] 6.1 创建 `.github/workflows/` 目录
- [ ] 6.2 创建 `.github/workflows/ci.yml`：触发条件 `pull_request` → main，步骤：`pnpm install --frozen-lockfile` → `pnpm run build:service`（复用现有 turbo build）
- [ ] 6.3 在 `ci.yml` 中配置 pnpm 缓存（`actions/setup-node` + `cache: 'pnpm'`）以加速 CI

## 7. GitHub Actions — Release workflow

- [ ] 7.1 创建 `.github/workflows/release.yml`：触发条件 `push` → main
- [ ] 7.2 在 `release.yml` 中添加 `changesets/action@v1` step，配置 `title: "chore: version packages"`，`commit: "chore: version packages [skip ci]"`
- [ ] 7.3 在 `release.yml` 中添加注释占位的 publish step，注释标注 `TODO: 配置 NPM_TOKEN secret 后取消注释`
- [ ] 7.4 配置 `release.yml` 所需的 `GITHUB_TOKEN` 权限（`permissions: contents: write, pull-requests: write`）

## 8. PR Template

- [ ] 8.1 创建 `.github/pull_request_template.md`，包含：变更描述占位、checklist（测试、`pnpm changeset` 提醒、`pnpm lint` 通过）

## 9. 验证

- [x] 9.1 运行 `pnpm install` 验证 `prepare` 脚本触发 husky 初始化无报错
- [x] 9.2 用合法和非法 commit message 测试 `commit-msg` hook 拦截效果
- [x] 9.3 运行 `pnpm lint` 验证 ESLint 扫描 packages 目录无配置错误
- [x] 9.4 运行 `pnpm changeset status` 验证 changesets 配置可读取
- [x] 9.5 检查 `.husky/commit-msg` 和 `.husky/pre-commit` 文件权限为可执行
