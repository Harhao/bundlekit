---
"@bundlekit/docs-agent": patch
---

refactor: update deploy workflow to use wrangler-action directly

- Removed wrangler.toml configuration file
- Simplified CI/CD workflow to deploy from root directory
- Aligned with deploy-docs.yml workflow pattern
- Now uses wrangler-action with command-line parameters