<script setup lang="ts">
import { ref, computed } from 'vue'
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

const nav = [
  { to: '/', key: 'nav.dashboard', icon: 'i-carbon-dashboard' },
  { to: '/notes', key: 'nav.notes', icon: 'i-carbon-document' },
  { to: '/todos', key: 'nav.todos', icon: 'i-carbon-task' },
  { to: '/ai', key: 'nav.ai', icon: 'i-carbon-ai-status' }
]

function openPalette() {
  paletteOpen.value = true
}
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen bg-bg text-fg">
    <!-- 侧边栏：桌面纵向 / 移动端横向滚动顶部栏（审查 C-7 响应式） -->
    <aside class="flex md:flex-col flex-row items-center md:items-stretch gap-2 md:gap-0 p-3 md:p-4 border-b md:border-b-0 md:border-r border-border shrink-0 overflow-x-auto md:overflow-visible">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-1 py-2 md:mb-6 shrink-0">
        <span class="logo-mark w-9 h-9 rounded-xl text-white grid place-items-center text-base font-bold shrink-0">青</span>
        <div class="leading-tight hidden md:block">
          <div class="font-bold text-base tracking-wide">{{ t('app.name') }}</div>
          <div class="text-[11px] text-fg-faint">{{ t('app.tagline') }}</div>
        </div>
      </div>

      <!-- 导航 -->
      <nav class="flex md:flex-col flex-row gap-1 shrink-0">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          class="nav-item flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-fg-soft"
          active-class="nav-active"
          :aria-label="t(n.key)"
        >
          <span :class="n.icon" class="text-lg shrink-0" />
          <span class="hidden sm:inline">{{ t(n.key) }}</span>
        </RouterLink>
      </nav>

      <!-- 底部：搜索入口 + 设置 -->
      <div class="mt-auto flex md:flex-col flex-row items-center gap-2 md:gap-2 shrink-0 md:pt-2">
        <button
          class="search-trigger flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-fg-faint cursor-pointer"
          @click="openPalette"
          :aria-label="t('nav.searchAria')"
        >
          <span class="i-carbon-search text-base" />
          <span class="hidden sm:inline">{{ t('nav.search') }}</span>
          <kbd class="hidden md:inline ml-auto">⌘K</kbd>
        </button>

        <RouterLink
          to="/settings"
          class="nav-item flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-fg-soft"
          active-class="nav-active"
          :aria-label="t('nav.settings')"
        >
          <span class="i-carbon-settings text-lg shrink-0" />
          <span class="hidden sm:inline">{{ t('nav.settings') }}</span>
        </RouterLink>

        <div class="hidden md:flex px-3 py-1.5 text-[11px] text-fg-faint items-center gap-1.5">
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

.nav-item {
  position: relative;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.nav-item:hover {
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
