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
      'brand-soft': 'var(--c-brand-soft)',
      bg: 'var(--c-bg)',
      'bg-soft': 'var(--c-bg-soft)',
      fg: 'var(--c-fg)',
      'fg-soft': 'var(--c-fg-soft)',
      border: 'var(--c-border)'
    }
  }
})
