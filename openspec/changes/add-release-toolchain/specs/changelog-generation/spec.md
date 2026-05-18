## ADDED Requirements

### Requirement: 每个包的 CHANGELOG.md 由 changesets version 自动生成
运行 `pnpm version-packages` 后，系统 SHALL 在每个被更新的包目录下创建或更新 `CHANGELOG.md`，内容包含版本号、日期和对应 changeset 中的描述文本。

#### Scenario: 首次运行 version-packages 生成 CHANGELOG
- **WHEN** 包目录下没有 `CHANGELOG.md`，且有对应 changeset，运行 `pnpm version-packages`
- **THEN** 包目录下生成 `CHANGELOG.md`，包含新版本号和变更描述

#### Scenario: 再次运行 version-packages 追加到已有 CHANGELOG
- **WHEN** 包目录下已有 `CHANGELOG.md`，再次有新 changeset 并运行 `pnpm version-packages`
- **THEN** 新版本条目追加到 `CHANGELOG.md` 顶部，旧内容保留

#### Scenario: 未被 changeset 覆盖的包不生成 CHANGELOG 条目
- **WHEN** 某包没有对应的 changeset 文件
- **THEN** 该包的 `CHANGELOG.md` 不被修改，版本号不变

### Requirement: CHANGELOG 格式遵循 Keep a Changelog 惯例
每个版本条目 SHALL 包含：`## <version> - <date>` 标题和变更描述段落。

#### Scenario: CHANGELOG 条目包含版本和日期
- **WHEN** 生成的 `CHANGELOG.md` 中查看某版本条目
- **THEN** 条目 header 格式为 `## X.Y.Z` 并附有日期
