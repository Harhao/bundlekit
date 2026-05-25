import { MDocument } from '@mastra/rag'
import { CloudflareEmbeddingModel } from '../../cloudflare/embedding-model'
import { CloudflareVector } from '@mastra/vectorize'
import fs from 'fs-extra'
import path from 'path'
import matter from 'gray-matter'
import { glob } from 'glob'

interface DocChunk {
  text: string
  metadata: {
    source: string
    title?: string
    section?: string
    [key: string]: any
  }
}

export async function processDocumentation(docsDir: string) {
  console.log(`Processing documentation from: ${docsDir}`)
  
  // Check environment variables
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
    return { success: false, fileCount: 0, chunkCount: 0 }
  }
  
  // Find all markdown files
  const markdownFiles = await glob('**/*.md', { cwd: docsDir, absolute: true })
  console.log(`Found ${markdownFiles.length} markdown files`)
  
  const allChunks: DocChunk[] = []
  
  for (const filePath of markdownFiles) {
    const relativePath = path.relative(docsDir, filePath)
    console.log(`Processing: ${relativePath}`)
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const { data: frontmatter, content: markdownContent } = matter(content)
      
      // Create document from markdown
      const doc = MDocument.fromMarkdown(markdownContent)
      
      // Chunk with markdown strategy
      const chunks = await doc.chunk({
        strategy: 'markdown',
        size: 500,
        overlap: 50,
      })
      
      // Add metadata to each chunk
      const chunksWithMetadata: DocChunk[] = chunks.map((chunk, index) => ({
        text: chunk.text,
        metadata: {
          source: relativePath,
          title: frontmatter.title || path.basename(filePath, '.md'),
          section: chunk.metadata?.section || `chunk-${index}`,
          ...frontmatter,
        },
      }))
      
      allChunks.push(...chunksWithMetadata)
      console.log(`  → Created ${chunks.length} chunks`)
    } catch (error) {
      console.error(`Error processing ${relativePath}:`, error)
    }
  }
  
  console.log(`Total chunks created: ${allChunks.length}`)
  
  // Create embeddings
  console.log('Creating embeddings with Cloudflare Workers AI...')
  const embeddingModel = new CloudflareEmbeddingModel(
    accountId,
    apiToken,
    process.env.EMBEDDING_MODEL || '@cf/baai/bge-base-en-v1.5'
  )
  
  const { embeddings } = await embeddingModel.doEmbed({ values: allChunks.map(chunk => chunk.text) })
  
  // Store in Vectorize
  console.log('Storing in Cloudflare Vectorize...')
  const vectorStore = new CloudflareVector({
    accountId,
    apiToken,
  })
  
  // Create index if it doesn't exist
  try {
    await vectorStore.createIndex({
      indexName,
      dimension: 768, // BGE-base dimension
    })
    console.log(`Created index: ${indexName}`)
  } catch (error: any) {
    if (error.message?.includes('Authentication error') || error.message?.includes('10000')) {
      console.error('❌ Vectorize API permission error')
      console.log('Your API token does not have permission to access Vectorize.')
      console.log('Please create a new API token with the following permissions:')
      console.log('  - Cloudflare Workers AI: Edit')
      console.log('  - Cloudflare Vectorize: Edit')
      console.log('  - Account Settings: Read')
      console.log('See CLOUDFLARE_SETUP.md for detailed instructions.')
      return { success: false, fileCount: 0, chunkCount: 0 }
    } else if (error.message?.includes('already exists')) {
      console.log(`Index ${indexName} already exists, continuing...`)
    } else {
      console.log(`Note: ${error.message || 'Unknown error'}`)
      console.log(`Using existing index: ${indexName}`)
    }
  }
  
  // Upsert vectors - ensure metadata contains only strings
  await vectorStore.upsert({
    indexName,
    vectors: embeddings,
    metadata: allChunks.map(chunk => {
      const metadata: Record<string, string> = {
        text: chunk.text,
        source: chunk.metadata.source,
        title: chunk.metadata.title || '',
        section: chunk.metadata.section || '',
      }
      
      // Convert any non-string values to strings
      Object.entries(chunk.metadata).forEach(([key, value]) => {
        if (key !== 'text' && key !== 'source' && key !== 'title' && key !== 'section') {
          if (typeof value === 'string') {
            metadata[key] = value
          } else if (value !== undefined && value !== null) {
            metadata[key] = JSON.stringify(value)
          }
        }
      })
      
      return metadata
    }),
  })
  
  console.log('Documentation indexing complete!')
  console.log(`Indexed ${allChunks.length} chunks into Vectorize index: ${indexName}`)
  
  return { 
    success: true, 
    fileCount: markdownFiles.length, 
    chunkCount: allChunks.length 
  }
}