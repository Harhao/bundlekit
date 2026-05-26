// Cloudflare Worker - 完整的 RAG 文档查询 agent
// 使用 Cloudflare Workers AI 和 Vectorize

export interface Env {
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_API_AI_TOKEN: string
  VECTORIZE_INDEX_NAME: string
  EMBEDDING_MODEL: string
  CHAT_MODEL: string
}

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// 处理 CORS 预检请求
function handleOptions() {
  return new Response(null, {
    headers: corsHeaders,
  })
}

// 生成嵌入向量
async function generateEmbeddings(texts: string[], env: Env): Promise<number[][]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${env.EMBEDDING_MODEL || '@cf/baai/bge-base-en-v1.5'}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texts }),
    }
  )

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.result.data
}

// 向量搜索
async function searchVectors(queryEmbedding: number[], env: Env, topK = 3) {
  const indexName = env.VECTORIZE_INDEX_NAME || 'bundlekit-docs'
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/vectorize/v2/indexes/${indexName}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: queryEmbedding,
        topK,
        returnMetadata: 'all',
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Vectorize API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.result.matches
}

// 生成文本回答（非流式）
async function generateAnswer(question: string, context: string, env: Env): Promise<string> {
  const model = env.CHAT_MODEL || '@cf/meta/llama-3.1-8b-instruct'
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `你是一个 BundleKit 文档助手。根据提供的文档上下文回答问题。如果上下文中没有相关信息，请说明。

文档上下文：
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

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.result.response
}

// 生成文本回答（流式）
async function generateAnswerStream(question: string, context: string, env: Env): Promise<ReadableStream> {
  const model = env.CHAT_MODEL || '@cf/meta/llama-3.1-8b-instruct'
  
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CLOUDFLARE_API_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `你是一个 BundleKit 文档助手。根据提供的文档上下文回答问题。如果上下文中没有相关信息，请说明。

文档上下文：
${context}`,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        stream: true, // 启用流式输出
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status} ${response.statusText}`)
  }

  return response.body!
}

// 处理查询请求
async function handleQuery(request: Request, env: Env): Promise<Response> {
  try {
    const { question, maxResults = 3, stream = false } = await request.json() as { 
      question: string
      maxResults?: number
      stream?: boolean
    }
    
    if (!question) {
      return new Response(JSON.stringify({
        error: 'Missing question parameter'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. 生成问题嵌入
    const [questionEmbedding] = await generateEmbeddings([question], env)
    
    // 2. 向量搜索
    const matches = await searchVectors(questionEmbedding, env, maxResults)
    
    // 3. 构建上下文
    const context = matches
      .map((match: any) => {
        const metadata = match.metadata || {}
        return `来源: ${metadata.source || '未知'}\n内容: ${metadata.text || '无内容'}\n`
      })
      .join('\n---\n')
    
    // 4. 生成回答
    if (stream) {
      // 流式输出
      const answerStream = await generateAnswerStream(question, context, env)
      
      // 创建一个 TransformStream 来包装元数据
      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const encoder = new TextEncoder()
      
      // 先发送元数据
      const metadata = {
        question,
        sources: matches.map((match: any) => ({
          source: match.metadata?.source,
          score: match.score,
        })),
        timestamp: new Date().toISOString(),
      }
      
      writer.write(encoder.encode(JSON.stringify({ type: 'metadata', data: metadata }) + '\n'))
      
      // 然后转发流式内容
      const reader = answerStream.getReader()
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              writer.write(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'))
              break
            }
            // 转发数据块
            writer.write(encoder.encode(JSON.stringify({ type: 'chunk', data: new TextDecoder().decode(value) }) + '\n'))
          }
        } catch (error) {
          writer.write(encoder.encode(JSON.stringify({ type: 'error', data: (error as Error).message }) + '\n'))
        } finally {
          writer.close()
        }
      }
      
      pump()
      
      return new Response(readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    } else {
      // 非流式输出
      const answer = await generateAnswer(question, context, env)
      
      return new Response(JSON.stringify({
        question,
        answer,
        sources: matches.map((match: any) => ({
          source: match.metadata?.source,
          score: match.score,
        })),
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
  } catch (error) {
    console.error('Query error:', error)
    return new Response(JSON.stringify({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// 主 Worker 入口
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    
    // 处理 CORS 预检
    if (request.method === 'OPTIONS') {
      return handleOptions()
    }
    
    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        service: 'BundleKit Docs Agent',
        status: 'healthy',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          query: '/query',
          docs: '/docs',
        },
        configuration: {
          embeddingModel: env.EMBEDDING_MODEL || '@cf/baai/bge-base-en-v1.5',
          chatModel: env.CHAT_MODEL || '@cf/meta/llama-3.1-8b-instruct',
          vectorIndex: env.VECTORIZE_INDEX_NAME || 'bundlekit-docs',
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // 查询接口
    if (url.pathname === '/query' && request.method === 'POST') {
      return handleQuery(request, env)
    }
    
    // API 文档
    if (url.pathname === '/docs') {
      return new Response(`
# BundleKit 文档查询 Agent API

## 端点

### 1. 健康检查
GET /health

### 2. 查询文档（非流式）
POST /query
Content-Type: application/json

{
  "question": "How do I create a BundleKit project?",
  "maxResults": 3,
  "stream": false
}

### 3. 查询文档（流式）
POST /query
Content-Type: application/json

{
  "question": "How do I create a BundleKit project?",
  "maxResults": 3,
  "stream": true
}

流式响应格式：
- Content-Type: text/event-stream
- 每行是一个JSON对象
- 第一行：{"type": "metadata", "data": {...}}
- 后续行：{"type": "chunk", "data": "..."}
- 最后一行：{"type": "done"}

### 4. API 文档
GET /docs

## 响应格式

### 非流式响应：
{
  "question": "string",
  "answer": "string",
  "sources": [
    {
      "source": "string",
      "score": number
    }
  ],
  "timestamp": "ISO string"
}

### 流式响应：
逐行发送的JSON对象，包含类型和数据。
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }
    
    // 404
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: `No handler for ${request.method} ${url.pathname}`,
      availableEndpoints: ['/health', '/query', '/docs']
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}