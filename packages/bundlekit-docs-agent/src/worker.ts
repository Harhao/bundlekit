// Cloudflare Workers 入口点
// 这个文件用于将文档查询 agent 部署为 Cloudflare Worker

export interface Env {
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_API_AI_TOKEN: string
  VECTORIZE_INDEX_NAME: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    
    // 处理根路径请求
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        service: 'BundleKit Docs Agent',
        status: 'healthy',
        version: '0.0.1',
        endpoints: {
          health: '/health',
          query: '/query',
          ingest: '/ingest'
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // 处理查询请求
    if (url.pathname === '/query' && request.method === 'POST') {
      try {
        const { question } = await request.json() as { question: string }
        
        // 这里可以调用实际的查询逻辑
        // 目前返回模拟响应
        return new Response(JSON.stringify({
          question,
          answer: '这是来自 BundleKit 文档查询 Agent 的响应。',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Invalid request',
          message: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    // 处理索引请求
    if (url.pathname === '/ingest' && request.method === 'POST') {
      return new Response(JSON.stringify({
        message: 'Ingestion endpoint not implemented in Worker version',
        note: 'Please run ingestion locally with: pnpm ingest'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // 404 处理
    return new Response(JSON.stringify({
      error: 'Not Found',
      message: `No handler for ${request.method} ${url.pathname}`
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}