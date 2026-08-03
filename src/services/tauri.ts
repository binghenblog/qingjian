import type { AIConfig, AIProvider, ChatMessage, ChatRole } from './ai'

/**
 * 桌面端 AI 中转桥（审查 C-2 / C-3）。
 *
 * 通过 Tauri IPC 调用 Rust 后端 `ai-chat` 命令发起云端请求：密钥不进入前端 JS、规避
 * WebView 的 CSP / CORS 限制，token 经 Channel 流式推回。
 *
 * 关键点：本文件**绝不静态导入** `@tauri-apps/api`，只在运行时动态 `import()`，
 * 因此 Web 构建不会引入该依赖、也不会因未安装而报错。Web 端由 `isTauri()` 判定为
 * false，自动回退到直连的 CloudProvider。
 */

const DONE = '__DONE__'

/** 是否在 Tauri 桌面运行时内 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export class TauriCloudProvider implements AIProvider {
  id = 'tauri-cloud'
  name = '云端（桌面端中转）'
  type = 'cloud' as const
  constructor(private cfg: AIConfig) {}

  chat(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
    return tauriChat(this.cfg, messages, signal)
  }

  async listModels(): Promise<string[]> {
    return [this.cfg.model].filter(Boolean)
  }
}

async function* tauriChat(
  cfg: AIConfig,
  messages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  // 动态导入，确保 Web 构建不依赖 @tauri-apps/api（未安装）
  const core = await import('@tauri-apps/api/core')
  const channel = new core.Channel<string>()
  // 本次请求的唯一标识，用于 Rust 端按 id 精确取消（审查 M-7）
  const requestId = crypto.randomUUID()

  const queue: string[] = []
  let finished = false
  let aborted = false
  let resolveWait = () => {}
  let wait = new Promise<void>((r) => (resolveWait = r))

  channel.onmessage = (t: string) => {
    if (t === DONE) finished = true
    else queue.push(t)
    resolveWait()
  }

  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        aborted = true
        finished = true
        // 通知 Rust 端中止指定请求的 HTTP 流（审查 H-8 / M-7）
        core
          .invoke('cancel-ai-chat', { request_id: requestId })
          .catch(() => {})
        resolveWait()
      },
      { once: true }
    )
  }

  const invokeP = core.invoke('ai-chat', {
    config: { base_url: cfg.baseUrl, api_key: cfg.apiKey, model: cfg.model },
    messages: messages.map((m) => ({ role: m.role as ChatRole, content: m.content })),
    request_id: requestId,
    on_token: channel
  })

  // 启动即 reject（参数/序列化错误等）：记录错误并结束循环，避免 UI 永久卡「生成中」，
  // 也不产生未处理 rejection（审查 H-4）
  let invokeError: unknown = null
  invokeP.catch((e: unknown) => {
    invokeError = e
    finished = true
    resolveWait()
  })

  try {
    while (true) {
      while (queue.length) yield queue.shift() as string
      if (finished) break
      await wait
      wait = new Promise<void>((r) => (resolveWait = r))
    }
    // 等待 Rust 命令真正结束（无论成功/失败），避免悬空 promise
    await invokeP.catch(() => {})
    if (invokeError && !aborted) throw invokeError
  } catch (e) {
    if (aborted) return
    throw e
  }
}
