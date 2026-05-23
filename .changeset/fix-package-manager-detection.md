---
"@bundlekit/shared-utils": patch
---

Fix package manager detection bugs:
- Fix LRU cache key conflict causing wrong package manager to be detected
- Fix async methods being called synchronously in constructor
- Fix execa not checking exit code on failure
- Fix pnpm add command using 'install' instead of 'add'
- Remove incompatible --shamefully-hoist flag
