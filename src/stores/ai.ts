import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { chatStorage } from '@/services/storage'
import { createProvider, type ChatMessage, type AIConfig } from '@/services/ai'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'
import i18n from '@/i18n'
import type { ChatSession } from '@/types'

/** 流式更新防抖保存间隔（ms）：避免每个 token 都写盘 */
const SAVE_DEBOUNCE = 400

/** 本地化包装（store 层无法用 useI18n，统一走 i18n.global） */
function tt(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params as Record<string, unknown>) as string
}

interface AskOptions {
  /** 用户侧指令（作为首条 user 消息） */
  instruction: string
  /** 注入给模型的本地数据上下文（作为 system 消息） */
  context: string
  /** 会话标题；省略则由首条指令自动提取 */
  sessionTitle?: string
}

/**
 * AI 会话 Store：管理多会话列表与当前会话，流式发送与上下文注入均在此完成，
 * 会话内容防抖持久化到本地数据库（刷新/重启保留，并纳入备份）。
 */
export const useAiStore = defineStore('ai', () => {
  const sessions = ref<ChatSession[]>([])
  const currentId = ref<string | null>(null)
  const loaded = ref(false)
  const isStreaming = ref(false)
  /** 屏幕阅读器状态播报（生成中/停止/出错） */
  const status = ref('')
  /** 全局通知：删除会话失败对用户可见（审查 M-2） */
  const { error: toastError } = useToast()
  let saveTimer: number | undefined
  let controller: AbortController | null = null

  function buildConfig(): AIConfig {
    const s = useSettingsStore()
    return { type: s.aiProvider, baseUrl: s.aiBaseUrl, apiKey: s.aiApiKey, model: s.aiModel }
  }

  function needsKey(): boolean {
    const s = useSettingsStore()
    return s.aiProvider === 'cloud' && !s.aiApiKey.trim()
  }

  function newSession(seedTitle = ''): ChatSession {
    const now = Date.now()
    return { id: crypto.randomUUID(), title: seedTitle, createdAt: now, updatedAt: now, messages: [] }
  }

  async function load() {
    if (loaded.value) return
    try {
      const list = await chatStorage.listChats()
      sessions.value = list
      if (sessions.value.length === 0) {
        const s = newSession()
        sessions.value.push(s)
        await chatStorage.saveChat(s)
      }
      currentId.value = sessions.value[0]?.id ?? null
    } catch {
      // 存储不可用时降级为纯内存态，仍可用（重启即清）
      if (sessions.value.length === 0) {
        sessions.value = [newSession()]
        currentId.value = sessions.value[0].id
      }
    }
    loaded.value = true
  }

  const current = computed(() => sessions.value.find((s) => s.id === currentId.value) ?? null)

  function selectSession(id: string) {
    currentId.value = id
  }

  function addSession() {
    const s = newSession()
    sessions.value.unshift(s)
    currentId.value = s.id
    void chatStorage.saveChat(s).catch(() => {})
  }

  async function renameSession(id: string, title: string) {
    const s = sessions.value.find((x) => x.id === id)
    if (!s) return
    s.title = title.trim().slice(0, 40)
    s.updatedAt = Date.now()
    await chatStorage.saveChat(s).catch(() => {})
  }

  async function deleteSession(id: string) {
    try {
      // 先删磁盘，成功后再改内存；删除失败则保留内存态并提示，避免「已删」复活（审查 M-2）
      await chatStorage.deleteChat(id)
    } catch (e) {
      const msg = tt('errors.aiDeleteFailed', { msg: (e as Error).message })
      toastError(msg)
      throw e
    }
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (currentId.value === id) {
      if (sessions.value.length === 0) addSession()
      else currentId.value = sessions.value[0].id
    }
  }

  /** 首条用户消息自动成为标题（未命名时） */
  function ensureTitle(s: ChatSession) {
    if (s.title) return
    const firstUser = s.messages.find((m) => m.role === 'user')
    if (firstUser) s.title = firstUser.content.slice(0, 20).replace(/\n/g, ' ').trim()
  }

  /** 防抖保存指定会话（默认当前会话）；传入被修改的会话引用，避免切换会话后误存其它会话（审查 H-1） */
  function scheduleSave(target?: ChatSession) {
    clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const s = target ?? current.value
      if (s) chatStorage.saveChat(s).catch(() => {})
    }, SAVE_DEBOUNCE)
  }

  /** 停止当前流式生成（审查 M-3） */
  function stop() {
    controller?.abort()
  }

  /**
   * 发送一条消息（支持带上下文的会话）。
   * 上下文作为 system 消息注入，不进入可见历史；用户消息入栈后流式追加 assistant 回复。
   */
  async function send(text?: string) {
    const content = (text ?? '').trim()
    const session = current.value
    if (!content || isStreaming.value || !session) return
    if (needsKey()) return
    session.messages.push({ role: 'user', content, id: crypto.randomUUID() })
    isStreaming.value = true
    status.value = tt('ai.generating')

    const assistant = { role: 'assistant' as const, content: '', id: crypto.randomUUID() }
    session.messages.push(assistant)

    const messages: ChatMessage[] = session.messages
      .filter((b) => b !== assistant && b.content)
      .map((b) => ({ role: b.role, content: b.content }))
    if (session.context?.trim()) {
      messages.unshift({ role: 'system', content: session.context })
    }

    controller = new AbortController()
    try {
      const provider = createProvider(buildConfig())
      for await (const token of provider.chat(messages, controller.signal)) {
        assistant.content += token
      }
      if (!assistant.content) assistant.content = tt('ai.emptyModelResponse')
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        if (!assistant.content) assistant.content = tt('ai.stopped')
        status.value = tt('ai.stoppedStatus')
      } else {
        const msg = e instanceof Error ? e.message : tt('ai.errorFallback')
        assistant.content = tt('ai.errorBody', { msg })
        status.value = tt('ai.errorStatus')
      }
    } finally {
      controller = null
      isStreaming.value = false
      scheduleSave(session)
    }
  }

  /**
   * 基于本地数据发起一次 AI 对话：新建带上下文的会话并立即发送指令。
   * 供命令面板 / 笔记页等外部入口调用（无需先在 /ai 页面打字）。
   */
  async function askWithContext(opts: AskOptions) {
    await load()
    const s = newSession(opts.sessionTitle ?? '')
    s.context = opts.context
    sessions.value.unshift(s)
    currentId.value = s.id
    await chatStorage.saveChat(s).catch(() => {})
    await send(opts.instruction)
  }

  /** 清空当前会话消息（审查 M-13）：中止流式、重置状态并落盘，避免直接改 .messages 绕过 store */
  function clearSession() {
    const s = current.value
    if (!s) return
    controller?.abort()
    isStreaming.value = false
    s.messages = []
    void chatStorage.saveChat(s).catch(() => {})
  }

  /** 监听当前会话消息变化：更新时间、派生标题、列表置顶、防抖落盘 */
  watch(
    () => current.value?.messages,
    () => {
      const s = current.value
      if (!s) return
      s.updatedAt = Date.now()
      ensureTitle(s)
      // 按更新时间倒序（最新会话置顶）
      sessions.value.sort((a, b) => b.updatedAt - a.updatedAt)
      scheduleSave(s)
    },
    { deep: true }
  )

  return {
    sessions,
    currentId,
    current,
    loaded,
    isStreaming,
    status,
    load,
    selectSession,
    addSession,
    renameSession,
    deleteSession,
    clearSession,
    send,
    stop,
    askWithContext,
    scheduleSave
  }
})
