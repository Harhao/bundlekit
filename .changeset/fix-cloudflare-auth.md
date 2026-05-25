---
"@bundlekit/docs-agent": patch
---

fix: add account_id to wrangler.toml to resolve Cloudflare authentication error

- Added account_id field to wrangler.toml configuration
- Fixes authentication error [code: 10000] when deploying to Cloudflare Workers
