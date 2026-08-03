import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

/**
 * 全局快捷键（M4）
 * - Alt+1~5：切换 仪表盘 / 笔记 / 待办 / AI / 设置
 * - Ctrl/⌘+K：命令面板（由 CommandPalette 自行监听）
 * 输入框聚焦时不拦截（Alt 组合一般不影响输入，但保持谨慎）。
 */
const NAV_KEYS: Record<string, string> = {
  '1': '/',
  '2': '/notes',
  '3': '/todos',
  '4': '/ai',
  '5': '/settings'
}

export function useShortcuts() {
  const router = useRouter()

  function onKeydown(e: KeyboardEvent) {
    // Ctrl/Cmd+N：快速新建任务（桌面端专属；输入框聚焦时不拦截，避免打断输入）
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (document.querySelector('.palette-mask, .confirm-mask')) return
      e.preventDefault()
      router.push('/todos')
      return
    }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    // 输入框 / 可编辑区聚焦时不拦截，避免误触导航（审查 L-4）
    const el = e.target as HTMLElement | null
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
    // 命令面板 / 确认弹窗打开时屏蔽导航快捷键，避免背后误切页面（审查 L-6）
    if (document.querySelector('.palette-mask, .confirm-mask')) return
    const to = NAV_KEYS[e.key]
    if (!to) return
    e.preventDefault()
    router.push(to)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
