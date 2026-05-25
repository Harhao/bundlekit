import { CloudflareEmbeddingModel } from '../src/cloudflare/embedding-model'
import 'dotenv/config'

async function testCloudflareConnection() {
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
  
  console.log('🔍 Testing Cloudflare connection...')
  console.log(`Account ID: ${accountId}`)
  console.log(`API Token: ${apiToken.substring(0, 10)}...`)
  
  try {
    // Test embedding model
    console.log('\n📊 Testing embedding model...')
    const embeddingModel = new CloudflareEmbeddingModel(accountId, apiToken)
    
    const testText = ['Hello world', 'BundleKit documentation']
    const { embeddings } = await embeddingModel.doEmbed({ values: testText })
    
    console.log(`✅ Embedding model works! Generated ${embeddings.length} embeddings`)
    console.log(`   Dimensions: ${embeddings[0].length}`)
    
    // Test vectorize API access (simple fetch)
    console.log('\n📚 Testing Vectorize API access...')
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Vectorize API access works!')
      console.log(`   Existing indexes: ${data.result?.length || 0}`)
    } else {
      console.log(`❌ Vectorize API error: ${response.status} ${response.statusText}`)
      const errorData = await response.json()
      console.log(`   Error: ${errorData.errors?.[0]?.message || 'Unknown error'}`)
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error)
  }
}

testCloudflareConnection()