import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'

// Tauri 内运行在 file:// 下，统一使用 hash 路由更稳。
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard, meta: { title: '仪表盘' } },
    { path: '/notes', name: 'notes', component: () => import('@/views/Notes.vue'), meta: { title: '笔记' } },
    { path: '/todos', name: 'todos', component: () => import('@/views/Todos.vue'), meta: { title: '待办' } },
    { path: '/ai', name: 'ai', component: () => import('@/views/AI.vue'), meta: { title: 'AI 助手' } },
    { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '设置' } }
  ]
})

export { router }
