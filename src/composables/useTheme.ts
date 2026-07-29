import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'qj-theme'
const theme = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function apply() {
  const dark = theme.value === 'dark' || (theme.value === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

watch(
  theme,
  () => {
    localStorage.setItem(STORAGE_KEY, theme.value)
    apply()
  },
  { immediate: true }
)

// 跟随系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme.value === 'system') apply()
})

export function useTheme() {
  return {
    theme,
    setTheme: (t: ThemeMode) => (theme.value = t),
    apply
  }
}
