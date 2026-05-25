import { Mastra } from '@mastra/core'
import { CloudflareVector } from '@mastra/vectorize'
import { docsAgent } from './agents/docs-agent'

// Check required environment variables
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const apiToken = process.env.CLOUDFLARE_API_AI_TOKEN

if (!accountId || !apiToken) {
  console.error('❌ Error: Required environment variables are not set.')
  console.error('')
  console.error('Please set the following environment variables in ~/.zshrc:')
  console.error('  export CLOUDFLARE_ACCOUNT_ID=your_account_id')
  console.error('  export CLOUDFLARE_API_AI_TOKEN=your_api_token')
  console.error('')
  console.error('Then reload your shell: source ~/.zshrc')
  process.exit(1)
}

export const mastra = new Mastra({
  agents: { docsAgent },
  vectors: {
    cloudflare: new CloudflareVector({
      accountId,
      apiToken,
    }),
  },
  server: {
    port: parseInt(process.env.PORT || '4111'),
  },
} as any)