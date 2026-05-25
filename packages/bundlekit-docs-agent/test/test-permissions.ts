import { CloudflareEmbeddingModel } from '../src/cloudflare/embedding-model'
import { CloudflareVector } from '@mastra/vectorize'
import 'dotenv/config'

async function testCloudflarePermissions() {
  console.log('🔍 Testing Cloudflare API permissions...\n')
  
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
  
  console.log(`Account ID: ${accountId}`)
  console.log(`API Token: ${apiToken.substring(0, 10)}...\n`)
  
  // Test 1: Workers AI API
  console.log('1. Testing Workers AI API (embedding)...')
  try {
    const embeddingModel = new CloudflareEmbeddingModel(accountId, apiToken)
    const { embeddings } = await embeddingModel.doEmbed({ values: ['Test'] })
    console.log('   ✅ Workers AI API works')
    console.log(`   Dimensions: ${embeddings[0].length}`)
  } catch (error: any) {
    console.log(`   ❌ Workers AI API failed: ${error.message}`)
  }
  
  // Test 2: Vectorize API - List indexes
  console.log('\n2. Testing Vectorize API (list indexes)...')
  try {
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
      console.log('   ✅ Vectorize API works')
      console.log(`   Existing indexes: ${data.result?.length || 0}`)
    } else {
      const errorData = await response.json()
      console.log(`   ❌ Vectorize API failed: ${response.status} - ${errorData.errors?.[0]?.message}`)
    }
  } catch (error: any) {
    console.log(`   ❌ Vectorize API failed: ${error.message}`)
  }
  
  // Test 3: Vectorize API - Create test index (if permission exists)
  console.log('\n3. Testing Vectorize API (create index permission)...')
  try {
    const testIndexName = 'test-permissions-' + Date.now()
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: testIndexName,
          dimensions: 768,
          metric: 'cosine',
        }),
      }
    )
    
    if (response.ok) {
      console.log('   ✅ Vectorize create index permission works')
      
      // Clean up - delete the test index
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${testIndexName}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
          },
        }
      )
      console.log('   (Cleaned up test index)')
    } else {
      const errorData = await response.json()
      console.log(`   ❌ Vectorize create index failed: ${response.status} - ${errorData.errors?.[0]?.message}`)
    }
  } catch (error: any) {
    console.log(`   ❌ Vectorize create index failed: ${error.message}`)
  }
  
  console.log('\n📋 Summary:')
  console.log('- If all tests pass: Your API token has correct permissions')
  console.log('- If Vectorize tests fail: Create new token with Vectorize permissions')
  console.log('  See CLOUDFLARE_SETUP.md for instructions')
}

testCloudflarePermissions()