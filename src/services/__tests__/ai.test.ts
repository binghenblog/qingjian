import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { CloudProvider, OllamaProvider, assertSafeUrl } from '../ai'
import { isTauri } from '../tauri'

// 检查 store 是否已暴露 needsKey（供 AI 视图统一判定复用，审查 M-31）
import { useAiStore } from '@/stores/ai'

function sse(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const buf = encoder.encode(lines.join('\n') + '\n')
  return new ReadableStream({
    start(c) {
      c.enqueue(buf)
      c.close()
    }
  })
}

function jsonFetch(body: string | ReadableStream<Uint8Array>, init: ResponseInit = {}) {
  return {
    ok: init.status ? init.status < 400 : true,
    status: init.status ?? 200,
    body: typeof body === 'string' ? null : body,
    text: async () => (typeof body === 'string' ? body : ''),
    ...init
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('assertSafeUrl', () => {
  it('合法 https / http 地址放行', () => {
    expect(assertSafeUrl('https://api.openai.com/v1', 'cloud')).toBe('https://api.openai.com/v1')
    expect(assertSafeUrl('http://127.0.0.1:11434/', 'local')).toBe('http://127.0.0.1:11434')
  })

  it('拒绝空地址 / 非 http(s) 协议', () => {
    expect(() => assertSafeUrl('', 'cloud')).toThrow()
    expect(() => assertSafeUrl('file:///etc/passwd', 'cloud')).toThrow()
    expect(() => assertSafeUrl('javascript:alert(1)', 'cloud')).toThrow()
  })

  it('cloud 模式拦截云元数据 / 内网字面量 IP（审查 M-23 / L-13）', () => {
    for (const bad of [
      'http://169.254.169.254/latest/meta-data',
      'http://169.254.169.254/',
      'http://0.0.0.0/',
      'http://10.0.0.1/',
      'http://172.16.0.1/',
      'http://192.168.1.1/',
      'http://127.0.0.1/'
    ]) {
      expect(() => assertSafeUrl(bad, 'cloud'), bad).toThrow()
    }
  })

  it('cloud 模式放行公网域名', () => {
    expect(assertSafeUrl('https://example.com/v1', 'cloud')).toBe('https://example.com/v1')
  })

  it('local 模式放行本机回环地址（Ollama 默认端点）', () => {
    expect(assertSafeUrl('http://127.0.0.1:11434', 'local')).toBe('http://127.0.0.1:11434')
  })
})

describe('CloudProvider（OpenAI 兼容 SSE 流）', () => {
  it('逐 delta 产出文本，[DONE] 结束', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonFetch(
        sse([
          'data: {"choices":[{"delta":{"content":"你"}}]}',
          'data: {"choices":[{"delta":{"content":"好"}}]}',
          'data: [DONE]'
        ])
      )
    )
    const p = new CloudProvider({ type: 'cloud', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' })
    const out: string[] = []
    for await (const t of p.chat([{ role: 'user', content: 'hi' }])) out.push(t)
    expect(out.join('')).toBe('你好')
  })

  it('非流式行（无 data: 前缀）被忽略', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonFetch(sse([': keep-alive', 'data: {"choices":[{"delta":{"content":"x"}}]}', 'data: [DONE]']))
    )
    const p = new CloudProvider({ type: 'cloud', baseUrl: 'https://api.openai.com/v1', model: 'm' })
    const out: string[] = []
    for await (const t of p.chat([])) out.push(t)
    expect(out.join('')).toBe('x')
  })

  it('401 抛出鉴权错误、429 抛出限流错误', async () => {
    const p = new CloudProvider({ type: 'cloud', baseUrl: 'https://api.openai.com/v1', model: 'm' })
    for (const [status, expectMsg] of [
      [401, '401'],
      [429, '429']
    ] as const) {
      vi.mocked(fetch).mockResolvedValueOnce(jsonFetch('', { status }))
      let caught = ''
      try {
        for await (const _ of p.chat([])) void _
      } catch (e) {
        caught = (e as Error).message
      }
      expect(caught, `status ${status}`).toContain(expectMsg)
    }
  })

  it('空 API Key 不携带 Authorization 头（审查 L-8）', async () => {
    const bodyPromise = vi.mocked(fetch).mockResolvedValueOnce(jsonFetch(sse(['data: [DONE]'])))
    const p = new CloudProvider({ type: 'cloud', baseUrl: 'https://api.openai.com/v1', model: 'm', apiKey: '  ' })
    for await (const _ of p.chat([])) void _
    expect(bodyPromise).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect((init as RequestInit).headers).not.toHaveProperty('Authorization')
  })
})

describe('OllamaProvider（ndjson 流）', () => {
  it('逐条 message.content 产出', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonFetch(
        sse([
          '{"message":{"content":"你"}}',
          '{"message":{"content":"好"}}',
          '{"message":{"content":"。"}}'
        ])
      )
    )
    const p = new OllamaProvider({ type: 'local', baseUrl: 'http://127.0.0.1:11434', model: 'llama3' })
    const out: string[] = []
    for await (const t of p.chat([])) out.push(t)
    expect(out.join('')).toBe('你好。')
  })

  it('HTTP 非 2xx 抛连接错误', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonFetch('', { status: 500 }))
    const p = new OllamaProvider({ type: 'local', baseUrl: 'http://127.0.0.1:11434', model: 'llama3' })
    await expect(async () => {
      for await (const _ of p.chat([])) void _
    }).rejects.toThrow()
  })
})

describe('Tauri 环境判定（tauri.ts isTauri）', () => {
  it('非 Tauri 环境下返回 false（Web 构建走直连）', () => {
    expect(isTauri()).toBe(false)
  })
})

describe('AI 视图 needsKey 与 store 复用（审查 M-31 一致性）', () => {
  it('useAiStore 暴露 needsKey 方法，视图可直接复用', () => {
    setActivePinia(createPinia())
    const store = useAiStore()
    expect(typeof store.needsKey).toBe('function')
  })
})
