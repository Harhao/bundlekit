import 'dotenv/config'
import { processDocumentation } from './mastra/rag/pipeline'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
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
  
  const docsPath = path.resolve(__dirname, '../../bundlekit-docs/docs')
  
  console.log('BundleKit Documentation Indexer')
  console.log('==============================')
  console.log(`Documentation path: ${docsPath}`)
  
  try {
    const result = await processDocumentation(docsPath)
    
    if (result.success) {
      console.log('\n✅ Indexing completed successfully!')
      console.log(`📄 Processed ${result.fileCount} files`)
      console.log(`📦 Created ${result.chunkCount} chunks`)
      console.log('\nYou can now query the documentation using the docs agent.')
    }
  } catch (error) {
    console.error('❌ Indexing failed:', error)
    process.exit(1)
  }
}

main()