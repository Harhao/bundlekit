import { generateText } from 'ai'
import { CloudflareEmbeddingModel } from '../src/cloudflare/embedding-model'
import 'dotenv/config'

async function simpleAgent() {
  console.log('Simple BundleKit Documentation Agent')
  console.log('====================================\n')
  
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
    return
  }
  
  // Test embedding
  const embeddingModel = new CloudflareEmbeddingModel(accountId, apiToken)
  const { embeddings } = await embeddingModel.doEmbed({ values: ['test'] })
  console.log(`✅ Embedding model works! Dimensions: ${embeddings[0].length}\n`)
  
  // Simple question answering
  const questions = [
    'How do I create a new BundleKit project?',
    'What bundlers are supported by BundleKit?',
  ]
  
  for (const question of questions) {
    console.log(`Question: ${question}`)
    
    // Use Cloudflare Workers AI via REST API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant for BundleKit documentation. Answer questions based on your knowledge.',
            },
            {
              role: 'user',
              content: question,
            },
          ],
        }),
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      console.log(`Answer: ${data.result.response}`)
    } else {
      console.log(`Error: ${response.status} ${response.statusText}`)
    }
    console.log('---')
  }
  
  console.log('✅ Simple agent test completed')
}

simpleAgent()