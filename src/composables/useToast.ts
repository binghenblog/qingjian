import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warn'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

export interface ToastOptions {
  type?: ToastType
  message: string
  /** 自动消失毫秒数；0 = 不自动消失（需手动点击关闭）。默认 error 6000ms，其余 3500ms */
  duration?: number
}

/** 全局通知队列（单例）：任意位置 import useToast() 即可推/取，独立于组件上下文 */
const toasts = reactive<ToastItem[]>([])
let seq = 0

export function useToast() {
  function dismiss(id: number) {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }

  function push(opts: ToastOptions): number {
    const id = ++seq
    toasts.push({ id, type: opts.type ?? 'info', message: opts.message })
    const duration = opts.duration ?? (opts.type === 'error' ? 6000 : 3500)
    if (duration > 0) {
      // 定时器包裹 try/catch，避免组件卸载后触发引发告警
      const timer = window.setTimeout(() => {
        try {
          dismiss(id)
        } catch {
          /* ignore */
        }
      }, duration)
      // 页面隐藏时不强求清除
      void timer
    }
    return id
  }

  const success = (message: string, duration?: number) => push({ type: 'success', message, duration })
  const error = (message: string, duration?: number) => push({ type: 'error', message, duration })
  const info = (message: string, duration?: number) => push({ type: 'info', message, duration })
  const warn = (message: string, duration?: number) => push({ type: 'warn', message, duration })

  return { toasts, push, dismiss, success, error, info, warn }
}
