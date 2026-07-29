export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

/** AI 通道配置（来自设置） */
export interface AIConfig {
  type: 'local' | 'cloud'
  baseUrl: string
  apiKey?: string
  model: string
}

export interface AIProvider {
  id: string
  name: string
  type: 'local' | 'cloud'
  /** 流式对话：逐 token 产出文本 */
  chat(messages: ChatMessage[]): AsyncGenerator<string, void, unknown>
  listModels(): Promise<string[]>
}

/** 本地 Ollama（直连 11434，ndjson 流） */
export class OllamaProvider implements AIProvider {
  id = 'ollama'
  name = '本地 Ollama'
  type = 'local' as const
  constructor(private cfg: AIConfig) {}

  async *chat(messages: ChatMessage[]): AsyncGenerator<string> {
    const base = this.cfg.baseUrl.replace(/\/$/, '')
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.cfg.model, messages, stream: true })
    })
    if (!res.ok || !res.body) throw new Error(`Ollama 连接失败 (${res.status})，确认本地已启动 Ollama`)
    yield* this.readNdjson(res.body)
  }

  private async *readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (!line) continue
        try {
          const obj = JSON.parse(line)
          if (obj.message?.content) yield obj.message.content as string
        } catch {
          /* 忽略不完整行 */
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    const base = this.cfg.baseUrl.replace(/\/$/, '')
    try {
      const res = await fetch(`${base}/api/tags`)
      if (!res.ok) return []
      const json = await res.json()
      return ((json.models as { name: string }[]) ?? []).map((m) => m.name)
    } catch {
      return []
    }
  }
}

/** 云端 OpenAI 兼容（SSE 流） */
export class CloudProvider implements AIProvider {
  id = 'cloud'
  name = '云端 OpenAI 兼容'
  type = 'cloud' as const
  constructor(private cfg: AIConfig) {}

  async *chat(messages: ChatMessage[]): AsyncGenerator<string> {
    const base = this.cfg.baseUrl.replace(/\/$/, '')
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cfg.apiKey ?? ''}`
      },
      body: JSON.stringify({ model: this.cfg.model, messages, stream: true })
    })
    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '')
      throw new Error(`云端请求失败 (${res.status})${txt ? ': ' + txt.slice(0, 200) : ''}`)
    }
    yield* this.readSSE(res.body)
  }

  private async *readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') return
        try {
          const obj = JSON.parse(data)
          const delta: string | undefined = obj.choices?.[0]?.delta?.content
          if (delta) yield delta
        } catch {
          /* 忽略不完整行 */
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    return [this.cfg.model].filter(Boolean)
  }
}

/** 按配置返回对应 provider 实例 */
export function createProvider(cfg: AIConfig): AIProvider {
  return cfg.type === 'cloud' ? new CloudProvider(cfg) : new OllamaProvider(cfg)
}
