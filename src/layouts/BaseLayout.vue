<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CommandPalette from '@/components/CommandPalette.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ToastHost from '@/components/ToastHost.vue'
import { useShortcuts } from '@/composables/useShortcuts'

useShortcuts()
const route = useRoute()
const paletteOpen = ref(false)
const { t } = useI18n()

/** 当前页标题：经 i18n 渲染（审查 M-29 / L-8） */
const pageTitle = computed(() => {
  const k = route.meta.titleKey
  return typeof k === 'string' ? t(k) : t('app.name')
})

// 侧边栏收起状态（持久化到 localStorage，审查 C-7 响应式）
const NAV_KEY = 'qingjian.navCollapsed'
const collapsed = ref(false)
try {
  collapsed.value = localStorage.getItem(NAV_KEY) === '1'
} catch {
  /* ignore */
}
watch(collapsed, (v) => {
  try {
    localStorage.setItem(NAV_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
})
function toggleCollapse() {
  collapsed.value = !collapsed.value
}

// 导航：图标在上、文字在下的圆角卡片（v0.3.0 导航改版）
const nav = [
  { to: '/', key: 'nav.dashboard', icon: 'i-carbon-dashboard' },
  { to: '/notes', key: 'nav.notes', icon: 'i-carbon-document' },
  { to: '/todos', key: 'nav.todos', icon: 'i-carbon-task' },
  { to: '/ledger', key: 'nav.ledger', icon: 'i-carbon-calculator' },
  { to: '/fitness', key: 'nav.fitness', icon: 'i-carbon-run' },
  { to: '/anniversaries', key: 'nav.anniversaries', icon: 'i-carbon-calendar' },
  { to: '/quotes', key: 'nav.quotes', icon: 'i-carbon-bookmark' },
  { to: '/ai', key: 'nav.ai', icon: 'i-carbon-ai-status' }
]

function openPalette() {
  paletteOpen.value = true
}
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen bg-bg text-fg">
    <!-- 侧边栏：桌面纵向 / 移动端横向滚动顶部栏（审查 C-7 响应式） -->
    <aside
      class="flex md:flex-col flex-row items-center md:items-stretch gap-2 p-3 border-b md:border-b-0 md:border-r border-border shrink-0 overflow-x-auto md:overflow-visible md:transition-[width] md:duration-200"
      :class="collapsed ? 'md:w-[78px]' : 'md:w-60'"
    >
      <!-- 顶部：收起按钮 + Logo -->
      <div class="flex items-center gap-2 px-1 py-2 md:mb-4 shrink-0 w-full">
        <button
          class="collapse-btn grid place-items-center w-9 h-9 rounded-xl text-fg-soft hover:bg-surface-hover shrink-0"
          @click="toggleCollapse"
          :aria-label="t('nav.collapseAria')"
          :title="t('nav.collapseAria')"
        >
          <span :class="collapsed ? 'i-carbon-chevron-right' : 'i-carbon-chevron-left'" class="text-lg" />
        </button>
        <div class="flex items-center gap-2 min-w-0" :class="collapsed ? 'md:hidden' : ''">
          <span class="logo-mark w-9 h-9 rounded-xl text-white grid place-items-center text-base font-bold shrink-0">青</span>
          <div class="leading-tight hidden md:block">
            <div class="font-bold text-base tracking-wide truncate">{{ t('app.name') }}</div>
            <div class="text-[11px] text-fg-faint truncate">{{ t('app.tagline') }}</div>
          </div>
        </div>
      </div>

      <!-- 导航 -->
      <nav class="flex md:flex-col flex-row gap-1.5 shrink-0">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          class="nav-card flex md:flex-col flex-row items-center justify-center gap-1 px-3 py-2 rounded-xl text-fg-soft"
          active-class="nav-active"
          :aria-label="t(n.key)"
        >
          <span :class="n.icon" class="text-xl shrink-0" />
          <span class="text-[11px] leading-tight" :class="collapsed ? 'md:hidden' : ''">{{ t(n.key) }}</span>
        </RouterLink>
      </nav>

      <!-- 底部：搜索入口 + 设置 + 版本 -->
      <div class="mt-auto flex md:flex-col flex-row items-center gap-1.5 md:gap-1.5 shrink-0 md:pt-2">
        <button
          class="search-trigger flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-fg-faint cursor-pointer"
          @click="openPalette"
          :aria-label="t('nav.searchAria')"
          :class="collapsed ? 'md:justify-center' : ''"
        >
          <span class="i-carbon-search text-base shrink-0" />
          <span :class="collapsed ? 'md:hidden' : ''">{{ t('nav.search') }}</span>
          <kbd class="hidden md:inline ml-auto" :class="collapsed ? 'md:hidden' : ''">⌘K</kbd>
        </button>

        <RouterLink
          to="/settings"
          class="nav-card flex md:flex-col flex-row items-center justify-center gap-1 px-3 py-2 rounded-xl text-fg-soft"
          active-class="nav-active"
          :aria-label="t('nav.settings')"
        >
          <span class="i-carbon-settings text-xl shrink-0" />
          <span class="text-[11px] leading-tight" :class="collapsed ? 'md:hidden' : ''">{{ t('nav.settings') }}</span>
        </RouterLink>

        <div class="hidden md:flex px-3 py-1.5 text-[11px] text-fg-faint items-center gap-1.5" :class="collapsed ? 'md:hidden' : ''">
          <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
          {{ t('app.version') }}
        </div>
      </div>
    </aside>

    <!-- 主区 -->
    <main class="flex-1 overflow-hidden p-4 md:p-5">
      <div class="card h-full flex flex-col overflow-hidden">
        <header class="h-14 px-4 md:px-6 flex items-center justify-between border-b border-border shrink-0">
          <span class="font-semibold truncate">{{ pageTitle }}</span>
          <span class="text-xs text-fg-faint hidden sm:inline">{{ t('app.footer') }}</span>
        </header>
        <div class="flex-1 overflow-auto p-4 md:p-6">
          <slot />
        </div>
      </div>
    </main>

    <CommandPalette v-model:open="paletteOpen" />
    <ConfirmDialog />
    <ToastHost />
  </div>
</template>

<style scoped>
.logo-mark {
  background: var(--c-brand-grad);
  box-shadow: 0 4px 12px var(--c-brand-soft);
}

.search-trigger {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.search-trigger:hover {
  border-color: var(--c-brand);
  box-shadow: 0 0 0 3px var(--c-brand-soft);
}

.nav-card {
  position: relative;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.nav-card:hover {
  background: var(--c-surface-hover);
  color: var(--c-fg);
}
.nav-active {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  font-weight: 600;
}
.nav-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  border-radius: 0 4px 4px 0;
  background: var(--c-brand-grad);
}
.dark .nav-active {
  color: var(--c-brand);
}
</style>
