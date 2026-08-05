import { createApp } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import i18n from './i18n'
import { useTodoStore } from './stores/todos'
import 'uno.css'
import './styles/theme.css'

/** 全局错误兜底：任何未捕获的运行时错误都给出可见反馈，而非静默白屏（审查 H-14 / M-47） */
function showErrorBanner(msg: string) {
  if (document.getElementById('qj-error-banner')) return
  const el = document.createElement('div')
  el.id = 'qj-error-banner'
  el.setAttribute('role', 'alert')
  el.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:12px 16px;' +
    'background:#dc2626;color:#fff;font:13px/1.5 system-ui,sans-serif;box-shadow:0 -2px 10px rgba(0,0,0,.2)'
  el.textContent = `⚠️ 出现错误：${msg}（可尝试刷新页面）`
  document.body.appendChild(el)
}

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)

  // 预加载待办（数据访问层为异步 IndexedDB），确保首屏 Dashboard / 命令面板
  // 在组件挂载前即可读到数据，避免闪空。失败不阻塞启动（store 内已兜底）。
  try {
    await useTodoStore().load()
  } catch {
    /* 已由 store 记录 loadError，UI 可降级提示 */
  }

  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue error]', err, info)
    showErrorBanner(err instanceof Error ? err.message : String(err))
  }

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    console.error('[unhandledrejection]', reason)
    showErrorBanner(reason instanceof Error ? reason.message : String(reason))
  })

  app.use(router).use(i18n).mount('#app')
}

bootstrap()
