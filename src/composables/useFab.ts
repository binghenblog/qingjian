import { ref } from 'vue'

/**
 * 全局悬浮新建按钮（FAB）的路由感知状态。
 *
 * 背景：原计划每个页面各自放一个 <FloatingActionButton>，导致「有的页面有、有的没有」，
 * 交互入口不一致（审查 UI 统一）。改为：FAB 只渲染一次（位于持久化的 BaseLayout），
 * 各页面在 onMounted 时用 setFab() 注册自己的「新建」处理函数，onUnmounted 时 clearFab()。
 * 当前路由对应的页面注册了处理器时，FAB 才显示并调用它——保证全部页面右下角一致。
 */
type FabHandler = (() => void) | null

const handler = ref<FabHandler>(null)
const label = ref('')

export function useFab() {
  /** 注册当前页面的「新建」处理函数（通常于 onMounted 调用） */
  function setFab(fn: () => void, text = '') {
    handler.value = fn
    label.value = text
  }
  /** 清除处理器（通常于 onUnmounted 调用），使 FAB 在当前页隐藏 */
  function clearFab() {
    handler.value = null
    label.value = ''
  }
  return { handler, label, setFab, clearFab }
}
