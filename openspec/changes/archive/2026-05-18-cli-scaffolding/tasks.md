## 1. Creator Fixes

- [x] 1.1 Fix variable reference errors in `creator.ts` (undefined `projectName`)
- [x] 1.2 Implement validateProjectName() with npm name validation
- [x] 1.3 Implement complete create flow: validate → template → generate → install → done
- [x] 1.4 Complete all TODO items in CLI `index.ts`

## 2. Generator Class

- [x] 2.1 Implement ejs-based template rendering in Generator class
- [x] 2.2 Implement recursive directory scanning (process `.ejs` files, copy others)
- [x] 2.3 Support conditional file generation based on template features

## 3. Mock Command

- [x] 3.1 Implement mock command: read `mock/` directory, start json-server
- [x] 3.2 Add `--port` and `--watch` options to mock command

## 4. Verification

- [x] 4.1 Run `pnpm build` for bundlekit-cli
- [x] 4.2 Test `create` command end-to-end
- [x] 4.3 Test `mock` command end-to-end
