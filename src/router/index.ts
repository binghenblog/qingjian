import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import i18n from '@/i18n'

// Tauri 内运行在 file:// 下，统一使用 hash 路由更稳。
declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题的 i18n key（审查 M-29 / L-8） */
    titleKey?: string
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: Dashboard, meta: { titleKey: 'nav.dashboard' } },
  { path: '/notes', name: 'notes', component: () => import('@/views/Notes.vue'), meta: { titleKey: 'nav.notes' } },
  { path: '/todos', name: 'todos', component: () => import('@/views/Todos.vue'), meta: { titleKey: 'nav.todos' } },
  { path: '/ai', name: 'ai', component: () => import('@/views/AI.vue'), meta: { titleKey: 'nav.ai' } },
  { path: '/ledger', name: 'ledger', component: () => import('@/views/Ledger.vue'), meta: { titleKey: 'nav.ledger' } },
  { path: '/fitness', name: 'fitness', component: () => import('@/views/Fitness.vue'), meta: { titleKey: 'nav.fitness' } },
  { path: '/anniversaries', name: 'anniversaries', component: () => import('@/views/Anniversaries.vue'), meta: { titleKey: 'nav.anniversaries' } },
  { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { titleKey: 'nav.settings' } },
  // 记好句已并入笔记模块（2026-08-04）：旧 /quotes 链接重定向到笔记
  { path: '/quotes', redirect: '/notes' },
  // 兜底：未知路径回仪表盘（审查 L-1）
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 同步页面标题（审查 L-2 / M-29）：经 i18n 渲染
router.afterEach((to) => {
  const key = to.meta.titleKey as string | undefined
  const title = key ? i18n.global.t(key) : ''
  document.title = title ? `${title} · 青简` : '青简'
})

export { router }
