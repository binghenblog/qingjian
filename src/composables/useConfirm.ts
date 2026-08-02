import { reactive } from 'vue'

export interface ConfirmOptions {
  /** 标题（可选） */
  title?: string
  /** 正文消息 */
  message: string
  /** 确认按钮文案（缺省走 i18n common.confirm） */
  confirmText?: string
  /** 取消按钮文案（缺省走 i18n common.cancel） */
  cancelText?: string
  /** 是否为危险操作（确认按钮红色高亮） */
  danger?: boolean
}

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  danger: boolean
}

/** 全局共享的确认弹窗状态（单例）：任意组件 setup 中调用 useConfirm().confirm() 即可弹出 */
const state = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmText: '',
  cancelText: '',
  danger: false
})

interface PendingConfirm {
  id: number
  opts: ConfirmOptions
  resolve: (v: boolean) => void
}

/**
 * 待确认队列（审查 M-12）：避免并发 confirm() 时后者覆盖前者的 resolver，
 * 导致前一个 Promise 永久悬挂。同一时刻只弹一个，关闭后自动展示下一个。
 */
let queue: PendingConfirm[] = []
let nextId = 0

/** 把队首项渲染进共享状态；队列空则关闭弹窗 */
function showCurrent() {
  const cur = queue[0]
  if (!cur) {
    state.open = false
    return
  }
  state.open = true
  state.title = cur.opts.title ?? ''
  state.message = cur.opts.message
  state.confirmText = cur.opts.confirmText ?? ''
  state.cancelText = cur.opts.cancelText ?? ''
  state.danger = cur.opts.danger ?? false
}

export function useConfirm() {
  /** 弹出确认框，返回用户选择（true=确认 / false=取消或遮罩点击） */
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      queue.push({ id: nextId++, opts, resolve })
      if (queue.length === 1) showCurrent()
    })
  }

  /** 以给定结果关闭弹窗并兑现当前 Promise，随后展示下一个待确认项（审查 M-12） */
  function resolve(v: boolean) {
    if (!state.open) return
    state.open = false
    const cur = queue.shift()
    cur?.resolve(v)
    showCurrent()
  }

  return { state, confirm, resolve }
}
