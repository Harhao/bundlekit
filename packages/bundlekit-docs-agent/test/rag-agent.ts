import { CloudflareEmbeddingModel } from '../src/cloudflare/embedding-model'
import { CloudflareVector } from '@mastra/vectorize'
import 'dotenv/config'

async function ragAgent() {
  console.log('RAG BundleKit Documentation Agent')
  console.log('=================================\n')
  
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_AI_TOKEN
  const indexName = process.env.VECTORIZE_INDEX_NAME || 'bundlekit-docs'
  
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
  
  console.log('1. Testing embedding model...')
  const embeddingModel = new CloudflareEmbeddingModel(accountId, apiToken)
  const { embeddings: [testEmbedding] } = await embeddingModel.doEmbed({ values: ['test'] })
  console.log(`   ✅ Embedding model works! Dimensions: ${testEmbedding.length}\n`)
  
  console.log('2. Testing vector search...')
  const vectorStore = new CloudflareVector({ accountId, apiToken })
  
  const questions = [
    'How do I create a new BundleKit project?',
    'What bundlers are supported by BundleKit?',
  ]
  
  for (const question of questions) {
    console.log(`\nQuestion: ${question}`)
    
    // Generate question embedding
    const { embeddings: [questionEmbedding] } = await embeddingModel.doEmbed({ values: [question] })
    
    // Search for similar documents
    const searchResults = await vectorStore.query({
      indexName,
      queryVector: questionEmbedding,
      topK: 3,
    })
    
    console.log(`Found ${searchResults.length} relevant documents`)
    
    // Build context from search results
    const context = searchResults
      .map((result: any) => {
        const metadata = result.metadata || {}
        return `Source: ${metadata.source || 'Unknown'}\nContent: ${metadata.text || 'No content'}\n`
      })
      .join('\n---\n')
    
    console.log('\nContext from documents:')
    console.log(context.substring(0, 500) + '...\n')
    
    // Use Cloudflare Workers AI with context
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
              content: `You are a helpful assistant for BundleKit documentation. Use the provided context to answer questions accurately. If the context doesn't contain relevant information, say so.

Context:
${context}`,
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
    
    console.log('\n' + '='.repeat(80))
  }
  
  console.log('\n✅ RAG agent test completed')
}

ragAgent()