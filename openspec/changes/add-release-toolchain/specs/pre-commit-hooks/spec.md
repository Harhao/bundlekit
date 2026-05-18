## ADDED Requirements

### Requirement: pre-commit hook 对暂存文件执行 lint fix
`git commit` 触发 `pre-commit` 时，系统 SHALL 对暂存的 `*.ts`、`*.tsx` 文件运行 `eslint --fix`，对所有暂存的 `*.ts`、`*.tsx`、`*.js`、`*.json`、`*.md` 文件运行 `prettier --write`，并将修改后的文件重新 stage。

#### Scenario: 暂存 TS 文件触发 lint 和 format
- **WHEN** `git add` 了一个 `.ts` 文件后执行 `git commit`
- **THEN** lint-staged 对该文件运行 eslint --fix 和 prettier --write，修复后文件重新加入暂存区

#### Scenario: 未暂存的文件不受影响
- **WHEN** 工作区有未暂存的修改
- **THEN** lint-staged 只处理已暂存文件，未暂存文件保持原样

#### Scenario: ESLint 报错（无法自动修复）阻断提交
- **WHEN** 暂存文件中有 ESLint 无法自动修复的 error
- **THEN** lint-staged 报错，提交被阻断，退出码非 0

### Requirement: lint-staged 配置声明在根目录 package.json 中
系统 SHALL 将 lint-staged 配置放在根目录 `package.json` 的 `lint-staged` 字段，而非独立配置文件。

#### Scenario: lint-staged 配置可被读取
- **WHEN** 运行 `pnpm lint-staged --debug`
- **THEN** 输出显示从根 package.json 读取到了匹配规则
