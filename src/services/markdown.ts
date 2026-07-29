import MarkdownIt from 'markdown-it'

/**
 * 共享的 MarkdownIt 单例（审查 M-26）：移到模块级，避免每个组件 mount 都重建实例。
 *
 * 安全（审查 H-7）：`html: false` 已禁掉原始 HTML 注入，但 `linkify: true` 会把
 * `javascript:alert(1)` 这类文本自动转成可点击链接。在 Tauri WebView / 浏览器里点击即可
 * 执行任意 JS。这里拦截危险协议，只允许 http/https/mailto/相对路径等安全链接。
 */
export const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true
})

md.validateLink = (url: string) => {
  const u = url.trim().toLowerCase()
  return !/^(javascript|vbscript|data|file):/.test(u)
}
