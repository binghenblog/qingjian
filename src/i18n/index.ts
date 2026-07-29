import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'

/**
 * i18n 实例（审查 L-38）。
 * legacy: false → 使用 Composition API（<script setup> 中 useI18n()）。
 * 默认 locale 为 zh-CN；模板内可用全局注入的 $t()，脚本内用 useI18n().t。
 */
export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN
  }
})

export default i18n
