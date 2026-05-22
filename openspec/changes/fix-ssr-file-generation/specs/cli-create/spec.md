## MODIFIED Requirements

### Requirement: Complete creation flow
The `create` command SHALL execute the full flow: validate name → select template → select bundler → select SSR → select package manager → enter description → generate files → write bundler to devDependencies → install dependencies (using selected PM) → invoke framework generator → print success message with PM-aware startup commands.

#### Scenario: Full creation flow succeeds with SSR enabled
- **WHEN** user runs `bundlekit-cli create my-app -t react-ts -b vite --ssr --pm pnpm`
- **THEN** files SHALL be generated in `./my-app`
- **AND** `entry-client.tsx` and `entry-server.tsx` SHALL be present
- **AND** `index.tsx` SHALL NOT be present
- **AND** `.bundlekitrc.ts` SHALL contain the `ssr` config block

#### Scenario: Full creation flow succeeds with SSR disabled
- **WHEN** user runs `bundlekit-cli create my-app -t react-ts -b vite --pm pnpm`
- **THEN** files SHALL be generated in `./my-app`
- **AND** `index.tsx` SHALL be present
- **AND** `entry-client.tsx` and `entry-server.tsx` SHALL NOT be present
- **AND** `.bundlekitrc.ts` SHALL NOT contain the `ssr` config block

#### Scenario: Full creation flow with all interactive prompts
- **WHEN** user runs `bundlekit-cli create my-app` and answers all prompts (template=react-ts, bundler=vite, ssr=no, pm=pnpm, description="demo")
- **THEN** the same outcome as the flag-driven scenario SHALL hold
- **AND** the user SHALL have been prompted in order: template → bundler → ssr → pm → description
