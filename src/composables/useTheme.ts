import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'qj-theme'
const theme = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

let animTimer: number | undefined

function apply(animate = false) {
  const root = document.documentElement
  // 仅在主题切换瞬间启用全局颜色过渡，避免常驻过渡干扰组件自身动效（审查 M-18）
  if (animate) {
    root.classList.add('theme-anim')
    clearTimeout(animTimer)
    animTimer = window.setTimeout(() => root.classList.remove('theme-anim'), 300)
  }
  const dark = theme.value === 'dark' || (theme.value === 'system' && systemPrefersDark())
  root.classList.toggle('dark', dark)
}

let initialized = false
watch(
  theme,
  () => {
    localStorage.setItem(STORAGE_KEY, theme.value)
    apply(initialized) // 首次应用不加动画，用户切换才加
    initialized = true
  },
  { immediate: true }
)

// 跟随系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme.value === 'system') apply(true)
})

export function useTheme() {
  return {
    theme,
    setTheme: (t: ThemeMode) => (theme.value = t),
    apply
  }
}
