---
'@bundlekit/docs-agent': patch
---

Move sensitive environment variables from .env file to ~/.zshrc

- Remove CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_AI_TOKEN from .env file
- Update code to read these variables from environment (specifically ~/.zshrc)
- Update all documentation and error messages to reflect the new configuration method
- Improve security by not storing sensitive credentials in the repository