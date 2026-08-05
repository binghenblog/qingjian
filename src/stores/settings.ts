import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import i18n from '@/i18n'
import { hasSecureKeyStorage, storeApiKey, loadApiKey, deleteApiKey } from '@/services/tauri'

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
  /** 界面语言（审查 L-38 多语种） */
  locale: string
  /** 记账页是否显示「本周 / 本月」收支汇总（默认隐藏，由用户开关控制） */
  ledgerShowSummary: boolean
  /** 是否在导航栏与今日桌面显示 AI 助手入口（AI 暂不开发，可隐藏） */
  showAiEntry: boolean
  /** 首页 Hero 横幅是否被收起（true=已收起不显示；设置页「恢复横幅」置回 false） */
  dashboardHeroHidden: boolean
  /** 是否启用全局快捷键（Alt+1~5 / Ctrl+K / Ctrl+N；默认关闭，由设置页开关控制） */
  shortcutsEnabled: boolean
}

function load(): SettingsState {
  const def: SettingsState = {
    userName: '',
    aiProvider: 'local',
    aiBaseUrl: 'http://127.0.0.1:11434',
    aiModel: 'llama3',
    aiKeyRemember: false,
    locale: 'zh-CN',
    ledgerShowSummary: false,
    showAiEntry: false,
    dashboardHeroHidden: false,
    shortcutsEnabled: false
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
 * 安全（审查 C-4 / R-1）：API Key 不进主设置 JSON；
 * - 桌面端（Tauri 且非移动）：经系统凭据库加密保管（store-api-key / load-api-key / delete-api-key），
 *   不再落浏览器存储；
 * - Web / 移动端：默认仅存 sessionStorage（关闭浏览器即清除），用户显式开启「记住密钥」才写入 localStorage。
 */
export const useSettingsStore = defineStore('settings', () => {
  const s = load()
  const userName = ref(s.userName)
  const aiProvider = ref<AIProviderType>(s.aiProvider)
  const aiBaseUrl = ref(s.aiBaseUrl)
  const aiModel = ref(s.aiModel)
  const aiKeyRemember = ref(s.aiKeyRemember)
  // 桌面端 Key 异步从系统凭据库读取（store 创建后立即发起，设置页打开前通常已就绪）；
  // Web/移动端同步读浏览器存储。
  const aiApiKey = ref('')
  const locale = ref(s.locale)
  const ledgerShowSummary = ref(s.ledgerShowSummary)
  const showAiEntry = ref(s.showAiEntry)
  const dashboardHeroHidden = ref(s.dashboardHeroHidden)
  const shortcutsEnabled = ref(s.shortcutsEnabled)

  const secure = hasSecureKeyStorage()
  if (secure) {
    loadApiKey()
      .then((k) => {
        if (k) {
          aiApiKey.value = k
          return
        }
        // 迁移（审查 R-1）：旧版明文 Key 若残留在浏览器存储，迁入系统凭据库后清除。
        // 「记住」开关旧值仅决定从哪读，两处都检查以覆盖历史版本。
        const legacy = loadKey(true) || loadKey(false)
        if (legacy) {
          storeApiKey(legacy)
            .then(() => {
              aiApiKey.value = legacy
              try {
                localStorage.removeItem(KEY_STORAGE)
                sessionStorage.removeItem(KEY_STORAGE)
              } catch {
                /* ignore */
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  } else {
    aiApiKey.value = loadKey(s.aiKeyRemember)
  }

  // 语言切换：写入 i18n 全局 locale，界面即时更新（审查 L-38）
  watch(locale, (code) => {
    i18n.global.locale.value = code as 'zh-CN' | 'en-US'
  })

  // 主设置（不含 Key）：写盘加 200ms 防抖，避免每个 ref 变化都立即同步 localStorage（审查 M-9）
  let settingsTimer: number | undefined
  function persistNow() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          userName: userName.value,
          aiProvider: aiProvider.value,
          aiBaseUrl: aiBaseUrl.value,
          aiModel: aiModel.value,
          aiKeyRemember: aiKeyRemember.value,
          locale: locale.value,
          ledgerShowSummary: ledgerShowSummary.value,
          showAiEntry: showAiEntry.value,
          dashboardHeroHidden: dashboardHeroHidden.value,
          shortcutsEnabled: shortcutsEnabled.value
        })
      )
    } catch {
      /* localStorage 不可用（隐私模式 / 配额满）时静默忽略 */
    }
  }
  /** 立即落盘，绕过 200ms 防抖（备份导出 / 窗口关闭前调用，审查 M-5 / L-40） */
  function flush() {
    clearTimeout(settingsTimer)
    persistNow()
  }
  /** 窗口/页面关闭前同步落盘，防止 200ms 防抖窗口内丢失最后改动（审查 L-40 / H-1 增补至设置项；todos/notes 已具备 beforeunload flush） */
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }
  watch([userName, aiProvider, aiBaseUrl, aiModel, aiKeyRemember, locale, ledgerShowSummary, showAiEntry, dashboardHeroHidden, shortcutsEnabled], () => {
    clearTimeout(settingsTimer)
    settingsTimer = window.setTimeout(persistNow, 200)
  })

  // Key 持久化：桌面端 → 系统凭据库；Web/移动端 → 浏览器存储（跟随「记住」开关迁移存储位置）
  watch([aiApiKey, aiKeyRemember], () => {
    if (secure) {
      const key = aiApiKey.value
      if (key) storeApiKey(key).catch(() => {})
      else deleteApiKey().catch(() => {})
    } else {
      persistKey(aiApiKey.value, aiKeyRemember.value)
    }
  })

  return { userName, aiProvider, aiBaseUrl, aiApiKey, aiModel, aiKeyRemember, locale, ledgerShowSummary, showAiEntry, dashboardHeroHidden, shortcutsEnabled, flush }
})
