import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

/** 支持的语言列表（设置页语言切换器用）。新增语言在此追加并到下方 messages 注册即可。 */
export const SUPPORTED_LOCALES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' }
] as const

const SUPPORTED_CODES = SUPPORTED_LOCALES.map((l) => l.code)

/** 启动时从持久化设置读回已选语言，避免刷新后回落默认语种（审查 L-38 多语种） */
function initialLocale(): string {
  try {
    const raw = localStorage.getItem('qingjian.settings')
    if (raw) {
      const parsed = JSON.parse(raw) as { locale?: unknown }
      if (typeof parsed.locale === 'string' && SUPPORTED_CODES.includes(parsed.locale as never)) {
        return parsed.locale
      }
    }
  } catch {
    /* ignore */
  }
  return 'zh-CN'
}

/**
 * i18n 实例（审查 L-38）。
 * legacy: false → 使用 Composition API（<script setup> 中 useI18n()）。
 * 默认 locale 为 zh-CN；模板内可用全局注入的 $t()，脚本内用 useI18n().t。
 */
export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export default i18n
