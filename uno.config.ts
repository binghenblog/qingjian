import { defineConfig, presetUno, presetIcons } from 'unocss'

/**
 * 全局设计令牌（UnoCSS 主题层）——与 src/styles/theme.css 的 CSS 变量一一对应。
 * 所有组件复用以下常量，杜绝大小混乱：
 *  · 圆角：card=16px（大卡片/面板/弹层）、btn=10px（按钮/小卡）、md/xl=12px（列表行/小面板）、sm=8px
 *  · 阴影：soft（单层柔和浅阴影，静止态唯一选择，浅色模式不过重）/ lift（hover 轻浮）/ overlay（弹层）
 *  · 间距：4px 基准阶梯——1=4 2=8 3=12 4=16 6=24（UnoCSS 默认即此，全项目统一复用 p-/m-/gap- 数值）
 */
export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({ scale: 1.2, warn: true })
  ],
  // 阻止 UnoCSS 把 h1/h2/h3 生成为「height」工具类，避免与 HTML 标题语义冲突（审查 M-41）
  blocklist: ['h1', 'h2', 'h3'],
  theme: {
    colors: {
      // 设计令牌（与 src/styles/theme.css 的 CSS 变量对应）
      brand: 'var(--c-brand)',
      'brand-strong': 'var(--c-brand-strong)',
      'brand-soft': 'var(--c-brand-soft)',
      bg: 'var(--c-bg)',
      surface: 'var(--c-surface)',
      'surface-hover': 'var(--c-surface-hover)',
      fg: 'var(--c-fg)',
      'fg-soft': 'var(--c-fg-soft)',
      'fg-faint': 'var(--c-fg-faint)',
      border: 'var(--c-border)',
      // 辅助色：成功=浅青；警告=橙黄（逾期任务）
      success: 'var(--c-success)',
      'success-soft': 'var(--c-success-soft)',
      warning: 'var(--c-warning)',
      'warning-soft': 'var(--c-warning-soft)'
    },
    borderRadius: {
      sm: '8px', // 小元素内角
      DEFAULT: 'var(--radius)', // 10px 按钮 / 小卡
      md: 'var(--radius-md)', // 12px 列表行 / 小面板
      lg: 'var(--radius)', // 10px 按钮（别名，统一按钮圆角）
      xl: 'var(--radius-md)', // 12px 小组件
      '2xl': 'var(--radius-lg)', // 16px 大卡片 / 面板
      '3xl': '24px',
      full: '9999px',
      card: 'var(--radius-lg)', // 语义类：大卡片 16px
      btn: 'var(--radius)' // 语义类：按钮 / 小卡 10px
    },
    boxShadow: {
      soft: 'var(--shadow-sm)', // 单层柔和浅阴影（默认 / 静止态唯一）
      lift: 'var(--shadow-md)', // hover 轻微上浮
      overlay: 'var(--shadow-lg)' // 弹层 / 命令面板
    }
  }
})
