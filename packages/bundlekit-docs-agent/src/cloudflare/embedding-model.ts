import type { EmbeddingModel } from 'ai'

export class CloudflareEmbeddingModel implements EmbeddingModel<string> {
  specificationVersion = 'v1' as const
  modelId: string
  maxEmbeddingsPerCall = 100
  supportsParallelCalls = true
  provider = 'cloudflare'

  constructor(
    private accountId: string,
    private apiToken: string,
    model = '@cf/baai/bge-base-en-v1.5'
  ) {
    this.modelId = model
  }

  async doEmbed(options: { values: string[]; abortSignal?: AbortSignal }) {
    const { values, abortSignal } = options
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.modelId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: values }),
        signal: abortSignal,
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.errors?.[0]?.message || response.statusText
      throw new Error(`Cloudflare API error: ${response.status} - ${errorMessage}`)
    }

    const data = await response.json()
    const embeddings = data.result.data as number[][]

    return {
      embeddings: embeddings.map(e => e as number[]),
      usage: { tokens: 0 },
    }
  }
}