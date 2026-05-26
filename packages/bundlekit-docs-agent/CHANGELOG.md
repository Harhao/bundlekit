# @bundlekit/docs-agent

## 0.0.4

### Patch Changes

- 0da93ee: fix: add account_id to wrangler.toml to resolve Cloudflare authentication error

  - Added account_id field to wrangler.toml configuration
  - Fixes authentication error [code: 10000] when deploying to Cloudflare Workers

- 60e64d5: refactor: update deploy workflow to use wrangler-action directly

  - Removed wrangler.toml configuration file
  - Simplified CI/CD workflow to deploy from root directory
  - Aligned with deploy-docs.yml workflow pattern
  - Now uses wrangler-action with command-line parameters

## 0.0.3

### Patch Changes

- 4607191: fix: add workingDirectory to wrangler-action to resolve monorepo deployment error

## 0.0.2

### Patch Changes

- 358901c: Move sensitive environment variables from .env file to ~/.zshrc

  - Remove CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_AI_TOKEN from .env file
  - Update code to read these variables from environment (specifically ~/.zshrc)
  - Update all documentation and error messages to reflect the new configuration method
  - Improve security by not storing sensitive credentials in the repository
