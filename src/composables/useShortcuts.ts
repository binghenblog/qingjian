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
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    const to = NAV_KEYS[e.key]
    if (!to) return
    e.preventDefault()
    router.push(to)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
