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

let resolver: ((v: boolean) => void) | null = null

export function useConfirm() {
  /** 弹出确认框，返回用户选择（true=确认 / false=取消或遮罩点击） */
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    state.open = true
    state.title = opts.title ?? ''
    state.message = opts.message
    state.confirmText = opts.confirmText ?? ''
    state.cancelText = opts.cancelText ?? ''
    state.danger = opts.danger ?? false
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  /** 以给定结果关闭弹窗并兑现 Promise */
  function resolve(v: boolean) {
    if (!state.open) return
    state.open = false
    resolver?.(v)
    resolver = null
  }

  return { state, confirm, resolve }
}
