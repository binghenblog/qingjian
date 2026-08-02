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

// 抽屉式导航开合状态（持久化到 localStorage）
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
// 路由跳转后自动收起抽屉，避免遮挡内容
function closeOnNavigate() {
  open.value = false
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
  <div class="relative h-screen bg-bg text-fg overflow-hidden">
    <!-- 常驻左上角的圆形导航按钮 -->
    <button
      class="nav-fab fixed top-4 left-4 z-50 grid place-items-center w-11 h-11 rounded-full text-white"
      @click="toggle"
      :aria-label="t('nav.toggleAria')"
      :aria-expanded="open ? 'true' : 'false'"
      :title="t('nav.toggleAria')"
    >
      <span :class="open ? 'i-carbon-close' : 'i-carbon-menu'" class="text-xl" />
    </button>

    <!-- 抽屉展开时的背景遮罩（点击收起） -->
    <transition name="fade">
      <div
        v-if="open"
        class="backdrop fixed inset-0 z-30 bg-black/40"
        @click="toggle"
        aria-hidden="true"
      />
    </transition>

    <!-- 左侧抽屉式导航（自适应窄宽，小屏限制最大宽度） -->
    <aside
      class="drawer fixed top-0 left-0 z-40 h-screen w-[220px] max-w-[78vw] bg-bg border-r border-border
             flex flex-col gap-2 p-3 pt-16 transition-transform duration-200 ease-out"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
      aria-label="main navigation"
    >
      <!-- 顶部：Logo（避开左上角 FAB） -->
      <div class="flex items-center gap-2 px-1 py-2 mb-1 shrink-0">
        <span class="logo-mark w-8 h-8 rounded-lg text-white grid place-items-center text-base font-bold shrink-0">青</span>
        <div class="leading-tight">
          <div class="font-bold text-base tracking-wide truncate">{{ t('app.name') }}</div>
          <div class="text-[11px] text-fg-faint truncate">{{ t('app.tagline') }}</div>
        </div>
      </div>

      <!-- 导航卡片（图标在上、文字在下） -->
      <nav class="flex flex-col gap-1.5 flex-1 overflow-y-auto overflow-x-hidden">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          class="nav-card flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-fg-soft"
          active-class="nav-active"
          :aria-label="t(n.key)"
          @click="closeOnNavigate"
        >
          <span :class="n.icon" class="text-xl shrink-0" />
          <span class="text-[11px] leading-tight">{{ t(n.key) }}</span>
        </RouterLink>
      </nav>

      <!-- 底部：搜索 + 设置 + 版本 -->
      <div class="flex flex-col gap-1.5 shrink-0 pt-2 border-t border-border">
        <button
          class="search-trigger flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-fg-faint cursor-pointer"
          @click="openPalette"
          :aria-label="t('nav.searchAria')"
        >
          <span class="i-carbon-search text-base shrink-0" />
          <span>{{ t('nav.search') }}</span>
          <kbd class="ml-auto">⌘K</kbd>
        </button>

        <RouterLink
          to="/settings"
          class="nav-card flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-fg-soft"
          active-class="nav-active"
          :aria-label="t('nav.settings')"
          @click="closeOnNavigate"
        >
          <span class="i-carbon-settings text-xl shrink-0" />
          <span class="text-[11px] leading-tight">{{ t('nav.settings') }}</span>
        </RouterLink>

        <div class="px-3 py-1.5 text-[11px] text-fg-faint flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block shrink-0" />
          {{ t('app.version') }}
        </div>
      </div>
    </aside>

    <!-- 主区（始终全宽，抽屉以遮罩方式覆盖） -->
    <main class="h-screen overflow-hidden p-4 md:p-5">
      <div class="card h-full flex flex-col overflow-hidden">
        <header class="h-14 pl-14 pr-4 md:px-6 flex items-center justify-between border-b border-border shrink-0">
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
.nav-fab {
  background: var(--c-brand-grad);
  box-shadow: 0 6px 18px var(--c-brand-soft);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.nav-fab:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px var(--c-brand-soft);
}
.dark .nav-fab {
  color: #0b1020;
}

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
  width: 3px;
  height: 20px;
  border-radius: 0 4px 4px 0;
  background: var(--c-brand-grad);
}
.dark .nav-active {
  color: var(--c-brand);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
