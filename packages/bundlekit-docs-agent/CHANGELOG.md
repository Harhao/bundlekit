# @bundlekit/docs-agent

## 0.0.3

### Patch Changes

- 2cf56d9: fix: vectorize config should use array syntax [[vectorize]] in wrangler.toml
- 4607191: fix: add workingDirectory to wrangler-action to resolve monorepo deployment error

## 0.0.2

### Patch Changes

- 358901c: Move sensitive environment variables from .env file to ~/.zshrc

  - Remove CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_AI_TOKEN from .env file
  - Update code to read these variables from environment (specifically ~/.zshrc)
  - Update all documentation and error messages to reflect the new configuration method
  - Improve security by not storing sensitive credentials in the repository
