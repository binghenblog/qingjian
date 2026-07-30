import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AIProviderType = 'local' | 'cloud'

const STORAGE_KEY = 'qingjian.settings'
const KEY_STORAGE = 'qingjian.ai-key'

interface SettingsState {
  userName: string
  aiProvider: AIProviderType
  aiBaseUrl: string
  aiModel: string
  /** 是否把 API Key 持久化到 localStorage（默认否，仅存会话） */
  aiKeyRemember: boolean
}

function load(): SettingsState {
  const def: SettingsState = {
    userName: '',
    aiProvider: 'local',
    aiBaseUrl: 'http://127.0.0.1:11434',
    aiModel: 'llama3',
    aiKeyRemember: false
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return def
    const parsed = JSON.parse(raw)
    // 迁移：旧版本把 aiApiKey 存在设置 JSON 里（明文），读出后立刻从主设置中剥离
    if (typeof parsed.aiApiKey === 'string' && parsed.aiApiKey) {
      try {
        localStorage.setItem(KEY_STORAGE, parsed.aiApiKey)
        parsed.aiKeyRemember = true
      } catch {
        /* ignore */
      }
      delete parsed.aiApiKey
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...def, ...parsed }))
    }
    return { ...def, ...parsed }
  } catch {
    return def
  }
}

/** 按「是否记住」从对应存储读 Key：记住 → localStorage；否则 → sessionStorage */
function loadKey(remember: boolean): string {
  try {
    return (remember ? localStorage.getItem(KEY_STORAGE) : sessionStorage.getItem(KEY_STORAGE)) ?? ''
  } catch {
    return ''
  }
}

function persistKey(key: string, remember: boolean) {
  try {
    if (remember) {
      localStorage.setItem(KEY_STORAGE, key)
      sessionStorage.removeItem(KEY_STORAGE)
    } else {
      sessionStorage.setItem(KEY_STORAGE, key)
      localStorage.removeItem(KEY_STORAGE)
    }
    if (!key) {
      localStorage.removeItem(KEY_STORAGE)
      sessionStorage.removeItem(KEY_STORAGE)
    }
  } catch {
    /* ignore */
  }
}

/**
 * 设置 Store。
 * 安全（审查 C-4）：API Key 不进主设置 JSON；默认仅存 sessionStorage（关闭浏览器即清除），
 * 用户显式开启「记住密钥」才写入 localStorage。桌面版将改为 Rust 后端加密保管。
 */
export const useSettingsStore = defineStore('settings', () => {
  const s = load()
  const userName = ref(s.userName)
  const aiProvider = ref<AIProviderType>(s.aiProvider)
  const aiBaseUrl = ref(s.aiBaseUrl)
  const aiModel = ref(s.aiModel)
  const aiKeyRemember = ref(s.aiKeyRemember)
  const aiApiKey = ref(loadKey(s.aiKeyRemember))

  // 主设置（不含 Key）：写盘加 200ms 防抖，避免每个 ref 变化都立即同步 localStorage（审查 M-9）
  let settingsTimer: number | undefined
  watch([userName, aiProvider, aiBaseUrl, aiModel, aiKeyRemember], () => {
    clearTimeout(settingsTimer)
    settingsTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            userName: userName.value,
            aiProvider: aiProvider.value,
            aiBaseUrl: aiBaseUrl.value,
            aiModel: aiModel.value,
            aiKeyRemember: aiKeyRemember.value
          })
        )
      } catch {
        /* localStorage 不可用（隐私模式 / 配额满）时静默忽略 */
      }
    }, 200)
  })

  // Key 单独持久化，跟随「记住」开关迁移存储位置
  watch([aiApiKey, aiKeyRemember], () => persistKey(aiApiKey.value, aiKeyRemember.value))

  return { userName, aiProvider, aiBaseUrl, aiApiKey, aiModel, aiKeyRemember }
})
