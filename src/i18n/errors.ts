import i18n from '@/i18n'

/**
 * 服务层 / Store 层错误国际化辅助（审查 H-14）。
 *
 * 服务与 Store 不直接依赖组件上下文，无法使用组合式 `useI18n()`，
 * 因此直接调用 i18n 全局实例的 `t()`。若 i18n 尚未就绪（理论上不会，
 * 因 main.ts 在挂载前已初始化），回退为 key 本身，绝不抛异常。
 */
export function le(key: string, params?: Record<string, unknown>): string {
  try {
    return i18n.global.t(key, params as Record<string, unknown>)
  } catch {
    return key
  }
}
