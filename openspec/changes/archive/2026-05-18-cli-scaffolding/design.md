## Design: CLI Scaffolding

### creator.ts

- Fix variable references: replace undefined `projectName` with `name` from args
- Flow: `validateProjectName()` → `selectTemplate()` → `new Generator().generate()` → `installDeps()` → `printSuccess()`

### Generator class

- Use `ejs` for template rendering
- Recursive directory walk: `.ejs` files → render with context, other files → copy
- Context: `{ projectName, description, features }`

### mock command

- Read `mock/` directory from project root
- Start json-server with `db.json` or route definitions
- `--port` flag for custom port, `--watch` flag for file watching
