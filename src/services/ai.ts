import { isTauri, TauriCloudProvider } from './tauri'
import { le } from '@/i18n/errors'

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
  /** 流式对话：逐 token 产出文本；signal 可中止请求（审查 M-3） */
  chat(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string, void, unknown>
  listModels(): Promise<string[]>
}

/**
 * 通用流式行读取（审查 M-4：ndjson 与 SSE 共用一套按行切分逻辑）。
 * 逐行产出去除首尾空白后的非空行。
 */
async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (line) yield line
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** 云端模式拦截的受限内部地址（审查 M-23 SSRF 防护，主要防云元数据凭证窃取） */
const BLOCKED_CLOUD_HOSTS = ['169.254.169.254', '0.0.0.0']
const BLOCKED_CLOUD_PREFIX = ['169.254.', 'fe80.', '::']

/**
 * 校验并归一化 AI 接口地址（审查 M-22 协议白名单 / M-23 SSRF 防护）。
 * - 必须 http/https 协议
 * - 云端模式拦截链路本地/元数据地址（如 169.254.169.254），避免凭证外泄
 *   （本地网关 127.0.0.1/localhost 仍允许，便于开发期本地代理）
 */
function assertSafeUrl(raw: string, kind: 'local' | 'cloud'): string {
  const base = raw.trim()
  if (!base) {
    throw new Error(le(kind === 'cloud' ? 'errors.aiUrlCloud' : 'errors.aiUrlLocal'))
  }
  let url: URL
  try {
    url = new URL(base)
  } catch {
    throw new Error(le('errors.aiUrlInvalid'))
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(le('errors.aiProtocolUnsupported', { protocol: url.protocol }))
  }
  if (kind === 'cloud') {
    const host = url.hostname.toLowerCase()
    const blocked =
      BLOCKED_CLOUD_HOSTS.includes(host) ||
      BLOCKED_CLOUD_PREFIX.some((p) => host.startsWith(p))
    if (blocked) throw new Error(le('errors.aiBlockedHost'))
  }
  return base.replace(/\/$/, '')
}

/** 本地 Ollama（直连 11434，ndjson 流） */
export class OllamaProvider implements AIProvider {
  id = 'ollama'
  name = '本地 Ollama'
  type = 'local' as const
  constructor(private cfg: AIConfig) {}

  async *chat(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
    const base = assertSafeUrl(this.cfg.baseUrl, 'local')
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.cfg.model, messages, stream: true }),
      signal
    })
    if (!res.ok || !res.body) throw new Error(le('errors.ollamaConnect', { status: res.status }))
    for await (const line of readLines(res.body)) {
      try {
        const obj = JSON.parse(line)
        if (obj.message?.content) yield obj.message.content as string
      } catch {
        /* 忽略不完整行 */
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

  async *chat(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
    const base = assertSafeUrl(this.cfg.baseUrl, 'cloud')
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
    // 空 Key 不携带 Authorization 头（审查 L-8）
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const key = this.cfg.apiKey?.trim()
    if (key) headers.Authorization = `Bearer ${key}`

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: this.cfg.model, messages, stream: true }),
      signal
    })
    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '')
      throw new Error(le('errors.cloudFailed', { status: res.status, detail: txt ? ': ' + txt.slice(0, 200) : '' }))
    }
    for await (const line of readLines(res.body)) {
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

  async listModels(): Promise<string[]> {
    return [this.cfg.model].filter(Boolean)
  }
}

/** 按配置返回对应 provider 实例 */
export function createProvider(cfg: AIConfig): AIProvider {
  if (cfg.type === 'cloud') {
    // 桌面版经 Rust 后端中转（审查 C-2/C-3）；Web 版直连
    if (isTauri()) return new TauriCloudProvider(cfg)
    return new CloudProvider(cfg)
  }
  return new OllamaProvider(cfg)
}
