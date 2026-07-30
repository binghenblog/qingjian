import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warn'

/** 可选的动作按钮（如「撤销」），点击后执行 onClick 并关闭该通知 */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: number
  type: ToastType
  message: string
  action?: ToastAction
}

export interface ToastOptions {
  type?: ToastType
  message: string
  /** 自动消失毫秒数；0 = 不自动消失（需手动点击关闭）。默认 error 6000ms，其余 3500ms */
  duration?: number
  /** 可选动作按钮（如撤销）；带 action 时建议设置较长 duration 给用户反应时间 */
  action?: ToastAction
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
    toasts.push({ id, type: opts.type ?? 'info', message: opts.message, action: opts.action })
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

  const success = (message: string, duration?: number, action?: ToastAction) =>
    push({ type: 'success', message, duration, action })
  const error = (message: string, duration?: number, action?: ToastAction) =>
    push({ type: 'error', message, duration, action })
  const info = (message: string, duration?: number, action?: ToastAction) =>
    push({ type: 'info', message, duration, action })
  const warn = (message: string, duration?: number, action?: ToastAction) =>
    push({ type: 'warn', message, duration, action })

  return { toasts, push, dismiss, success, error, info, warn }
}
