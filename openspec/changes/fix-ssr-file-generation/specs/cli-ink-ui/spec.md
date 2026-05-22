## MODIFIED Requirements

### Requirement: Step-based create flow
WHEN the create command needs `--template`, `--bundler`, and `--ssr`
AND none are provided as flags
THEN the cli SHALL render five sequential `<SelectInput>` steps: "模板" then "打包器" then "SSR" then "包管理器" then "描述"
AND the title bar SHALL show progress like "Step 1/5 · 模板"

#### Scenario: Full interactive flow with SSR step
- **WHEN** user runs `bundlekit-cli create my-app` in a TTY with no flags
- **THEN** the cli SHALL render 5 steps in order: 模板 → 打包器 → SSR → 包管理器 → 描述
- **AND** the progress indicator SHALL show "Step 3/5 · SSR" during the SSR selection

#### Scenario: SSR flag bypasses SSR step
- **WHEN** user runs `bundlekit-cli create my-app --ssr` in a TTY
- **THEN** the cli SHALL skip the SSR step
- **AND** the total visible steps SHALL be 4 (模板 → 打包器 → 包管理器 → 描述)

#### Scenario: All flags provided skips all prompts
- **WHEN** user runs `bundlekit-cli create my-app -t react-ts -b vite --ssr --pm pnpm -d "demo"`
- **THEN** the cli SHALL skip all interactive steps and proceed directly to tasks
