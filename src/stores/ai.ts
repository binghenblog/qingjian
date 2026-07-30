import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { chatStorage } from '@/services/storage'
import type { ChatSession } from '@/types'

/** 流式更新防抖保存间隔（ms）：避免每个 token 都写盘 */
const SAVE_DEBOUNCE = 400

/**
 * AI 会话 Store：管理多会话列表与当前会话，
 * 会话内容防抖持久化到本地数据库（刷新/重启保留，并纳入备份）。
 */
export const useAiStore = defineStore('ai', () => {
  const sessions = ref<ChatSession[]>([])
  const currentId = ref<string | null>(null)
  const loaded = ref(false)
  let saveTimer: number | undefined

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
    sessions.value = sessions.value.filter((s) => s.id !== id)
    await chatStorage.deleteChat(id).catch(() => {})
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

  /** 防抖保存当前会话 */
  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      const s = current.value
      if (s) chatStorage.saveChat(s).catch(() => {})
    }, SAVE_DEBOUNCE)
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
      scheduleSave()
    },
    { deep: true }
  )

  return {
    sessions,
    currentId,
    current,
    loaded,
    load,
    selectSession,
    addSession,
    renameSession,
    deleteSession,
    scheduleSave
  }
})
