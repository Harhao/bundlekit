import { CloudflareEmbeddingModel } from '../src/cloudflare/embedding-model'
import { CloudflareVector } from '@mastra/vectorize'
import readline from 'readline'
import 'dotenv/config'

async function interactiveRagAgent() {
  console.log('BundleKit Documentation Agent (RAG)')
  console.log('===================================\n')
  
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
  
  console.log('Initializing components...')
  const embeddingModel = new CloudflareEmbeddingModel(accountId, apiToken)
  const vectorStore = new CloudflareVector({ accountId, apiToken })
  
  console.log('✅ Ready to answer questions about BundleKit documentation')
  console.log('   Type "exit" to quit\n')
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  
  const askQuestion = () => {
    rl.question('\n> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('Goodbye!')
        rl.close()
        return
      }
      
      try {
        console.log('Thinking...')
        
        // Generate question embedding
        const { embeddings: [questionEmbedding] } = await embeddingModel.doEmbed({ values: [input] })
        
        // Search for similar documents
        const searchResults = await vectorStore.query({
          indexName,
          queryVector: questionEmbedding,
          topK: 3,
        })
        
        // Build context from search results
        const context = searchResults
          .map((result: any) => {
            const metadata = result.metadata || {}
            return `Source: ${metadata.source || 'Unknown'}\nContent: ${metadata.text || 'No content'}\n`
          })
          .join('\n---\n')
        
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
                  content: `You are a helpful assistant for BundleKit documentation. Use the provided context to answer questions accurately. If the context doesn't contain relevant information, say so. Answer in the same language as the user's question.

Context:
${context}`,
                },
                {
                  role: 'user',
                  content: input,
                },
              ],
            }),
          }
        )
        
        if (response.ok) {
          const data = await response.json()
          console.log('\n' + data.result.response)
        } else {
          console.log(`\nError: ${response.status} ${response.statusText}`)
        }
        
      } catch (error) {
        console.error('\nError:', error)
      }
      
      askQuestion()
    })
  }
  
  askQuestion()
}

interactiveRagAgent()