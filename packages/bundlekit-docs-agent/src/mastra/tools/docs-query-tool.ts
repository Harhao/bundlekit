import { createVectorQueryTool } from '@mastra/rag'
import { CloudflareEmbeddingModel } from '../../cloudflare/embedding-model'

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

export const docsQueryTool = createVectorQueryTool({
  vectorStoreName: 'cloudflare',
  indexName: process.env.VECTORIZE_INDEX_NAME || 'bundlekit-docs',
  model: new CloudflareEmbeddingModel(
    accountId,
    apiToken,
    process.env.EMBEDDING_MODEL || '@cf/baai/bge-base-en-v1.5'
  ) as any,
}) as any