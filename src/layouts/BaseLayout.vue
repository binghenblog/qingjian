<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CommandPalette from '@/components/CommandPalette.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ToastHost from '@/components/ToastHost.vue'
import KbdTip from '@/components/KbdTip.vue'
import { useSettingsStore } from '@/stores/settings'
import { useShortcuts } from '@/composables/useShortcuts'
import { appLogoDataUri } from '@/assets/logo'

useShortcuts()
const route = useRoute()
const settings = useSettingsStore()
const paletteOpen = ref(false)
const { t } = useI18n()

/** 当前页标题：经 i18n 渲染（审查 M-29 / L-8） */
const pageTitle = computed(() => {
  const k = route.meta.titleKey
  return typeof k === 'string' ? t(k) : t('app.name')
})

// 抽屉式导航开合状态（持久化到 localStorage）；仅由左上角按钮切换
const NAV_KEY = 'qingjian.navOpen'
const open = ref(false)
try {
  open.value = localStorage.getItem(NAV_KEY) === '1'
} catch {
  /* ignore */
}
watch(open, (v) => {
  try {
    localStorage.setItem(NAV_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
})
function toggle() {
  open.value = !open.value
}

/** Esc 关闭抽屉（审查 L-5）；背后主区保持可交互（非模态设计） */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    open.value = false
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// 导航：图标在上、文字在下的圆角卡片（v0.3.0 导航改版）
// 顺序：今日桌面 → 日程 → 记账 → 纪念日 → 笔记 → 健身
// AI 助手默认隐藏；若显示则置于列表最底部并降低透明度（dim），可在设置中开关（showAiEntry）
const nav = computed(() => {
  const base: { to: string; key: string; icon: string; dim?: boolean }[] = [
    { to: '/', key: 'nav.dashboard', icon: 'i-carbon-dashboard' },
    { to: '/todos', key: 'nav.todos', icon: 'i-carbon-task' },
    { to: '/ledger', key: 'nav.ledger', icon: 'i-carbon-calculator' },
    { to: '/anniversaries', key: 'nav.anniversaries', icon: 'i-carbon-calendar' },
    { to: '/notes', key: 'nav.notes', icon: 'i-carbon-document' },
    { to: '/fitness', key: 'nav.fitness', icon: 'i-carbon-run' }
  ]
  if (settings.showAiEntry) {
    base.push({ to: '/ai', key: 'nav.ai', icon: 'i-carbon-ai-status', dim: true })
  }
  return base
})

function openPalette() {
  paletteOpen.value = true
}
</script>

<template>
  <div class="relative h-screen bg-bg text-fg overflow-hidden">
    <!-- 常驻左上角、正方形的导航按钮（棱角稍圆、无阴影、仅此按钮切换抽屉） -->
    <button
      class="nav-fab fixed top-4 left-3 z-50 grid place-items-center w-10 h-10 rounded-lg text-white"
      @click="toggle"
      :aria-label="t('nav.toggleAria')"
      :aria-expanded="open ? 'true' : 'false'"
      :title="t('nav.toggleAria')"
    >
      <span :class="open ? 'i-carbon-close' : 'i-carbon-menu'" class="text-lg" />
    </button>

    <!-- 左侧抽屉式导航（自适应窄宽；桌面端打开时主区左移让位，仅按钮收起） -->
    <aside
      class="drawer fixed top-0 left-0 z-40 h-screen w-[190px] max-w-[72vw] bg-bg
             flex flex-col gap-2 p-3 pt-16 transition-transform duration-200 ease-out"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
      :inert="open ? undefined : true"
      :aria-hidden="open ? undefined : 'true'"
      aria-label="main navigation"
    >
      <!-- 顶部：Logo（避开左上角半圆按钮） -->
      <div class="flex items-center gap-2 px-1 py-2 mb-1 shrink-0">
        <img :src="appLogoDataUri" alt="青简" class="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-border/50 shadow-sm" />
        <div class="leading-tight">
          <div class="font-bold text-base tracking-wide truncate">{{ t('app.name') }}</div>
          <div class="text-[11px] text-fg-faint truncate">{{ t('app.tagline') }}</div>
        </div>
      </div>

      <!-- 导航卡片（图标在上、文字在下） -->
      <nav class="flex flex-col gap-1 flex-1 overflow-y-auto overflow-x-hidden">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          class="nav-card flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-fg-soft"
          :class="{ 'opacity-60 hover:opacity-100': n.dim }"
          active-class="nav-active"
          :aria-label="t(n.key)"
        >
          <span :class="n.icon" class="text-xl shrink-0" />
          <span class="text-[11px] leading-tight">{{ t(n.key) }}</span>
        </RouterLink>
      </nav>

      <!-- 底部：搜索 + 设置 + 版本 -->
      <div class="flex flex-col gap-1 shrink-0 pt-2 border-t border-border">
        <KbdTip :keys="'Ctrl K'" :label="t('kbd.search')">
          <button
            class="search-trigger flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-fg-faint cursor-pointer"
            @click="openPalette"
            :aria-label="t('nav.searchAria')"
          >
            <span class="i-carbon-search text-base shrink-0" />
            <span>{{ t('nav.search') }}</span>
          </button>
        </KbdTip>

        <RouterLink
          to="/settings"
          class="nav-card flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-fg-soft"
          active-class="nav-active"
          :aria-label="t('nav.settings')"
        >
          <span class="i-carbon-settings text-xl shrink-0" />
          <span class="text-[11px] leading-tight">{{ t('nav.settings') }}</span>
        </RouterLink>

        <div class="px-3 pt-2 pb-1 mt-1 text-[11px] text-fg-faint flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block shrink-0" />
          <span class="truncate leading-none">{{ t('app.version') }}</span>
        </div>
      </div>
    </aside>

    <!-- 主区（导航打开时左移 190px，右侧页面自动变窄；移动端保持覆盖） -->
    <main
      class="h-screen overflow-hidden p-4 md:p-5 transition-[margin] duration-200"
      :class="open ? 'md:ml-[190px]' : ''"
    >
      <div class="card h-full flex flex-col overflow-hidden">
        <header class="h-14 pl-14 pr-4 md:px-6 flex items-center justify-between border-b border-border shrink-0">
          <span class="font-semibold truncate">{{ pageTitle }}</span>
          <span class="text-[13px] text-fg-soft hidden sm:inline">{{ t('app.footer') }}</span>
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
.nav-fab {
  background: var(--c-brand-grad);
  transition: opacity 0.15s ease;
}
.nav-fab:hover {
  opacity: 0.92;
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
.search-trigger kbd {
  font-family: inherit;
  background: var(--c-surface-hover);
  border: 1px solid var(--c-border);
  border-radius: 6px;
  padding: 1px 6px;
  color: var(--c-fg-faint);
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
  width: 4px;
  height: 24px;
  border-radius: 0 4px 4px 0;
  background: var(--c-brand);
  box-shadow: 0 0 8px var(--c-brand-soft);
}
.dark .nav-active {
  color: var(--c-brand);
}
</style>
