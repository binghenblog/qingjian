import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({ scale: 1.2, warn: true })
  ],
  theme: {
    colors: {
      // 设计令牌（与 src/styles/theme.css 的 CSS 变量对应）
      brand: 'var(--c-brand)',
      'brand-strong': 'var(--c-brand-strong)',
      'brand-soft': 'var(--c-brand-soft)',
      bg: 'var(--c-bg)',
      surface: 'var(--c-surface)',
      'surface-hover': 'var(--c-surface-hover)',
      // 兼容旧类名
      'bg-soft': 'var(--c-surface)',
      fg: 'var(--c-fg)',
      'fg-soft': 'var(--c-fg-soft)',
      'fg-faint': 'var(--c-fg-faint)',
      border: 'var(--c-border)'
    }
  }
})
