import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type AIProviderType = 'local' | 'cloud'

const STORAGE_KEY = 'qingjian.settings'

interface SettingsState {
  aiProvider: AIProviderType
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
}

function load(): SettingsState {
  const def: SettingsState = {
    aiProvider: 'local',
    aiBaseUrl: 'http://127.0.0.1:11434',
    aiApiKey: '',
    aiModel: 'llama3'
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...def, ...JSON.parse(raw) } : def
  } catch {
    return def
  }
}

/** 设置 Store：持久化 AI 通道配置（localStorage） */
export const useSettingsStore = defineStore('settings', () => {
  const s = load()
  const aiProvider = ref<AIProviderType>(s.aiProvider)
  const aiBaseUrl = ref(s.aiBaseUrl)
  const aiApiKey = ref(s.aiApiKey)
  const aiModel = ref(s.aiModel)

  watch(
    [aiProvider, aiBaseUrl, aiApiKey, aiModel],
    () =>
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          aiProvider: aiProvider.value,
          aiBaseUrl: aiBaseUrl.value,
          aiApiKey: aiApiKey.value,
          aiModel: aiModel.value
        })
      ),
    { deep: true }
  )

  return { aiProvider, aiBaseUrl, aiApiKey, aiModel }
})
