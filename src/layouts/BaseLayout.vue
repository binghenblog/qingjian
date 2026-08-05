<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CommandPalette from '@/components/CommandPalette.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ToastHost from '@/components/ToastHost.vue'
import KbdTip from '@/components/KbdTip.vue'
import FloatingActionButton from '@/components/FloatingActionButton.vue'
import { useSettingsStore } from '@/stores/settings'
import { useShortcuts } from '@/composables/useShortcuts'
import { useFab } from '@/composables/useFab'
import { appLogoDataUri } from '@/assets/logo'

useShortcuts()
const settings = useSettingsStore()
const paletteOpen = ref(false)
const { t } = useI18n()
// 全局悬浮新建按钮：各页面 onMounted 注册自己的「新建」处理函数，此处统一渲染
const { handler, label } = useFab()

// ActionSheet 开合状态（持久化到 localStorage）；仅由移动端「更多」Tab 切换
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

/** Esc 关闭 ActionSheet（审查 L-5） */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    open.value = false
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// 桌面端导航：图标 + 文字横向并排（v0.6.0 改为固定窄侧边栏）
// 顺序：今日桌面 → 日程 → 记账 → 纪念日 → 笔记 → 健身（绝对不可改动）
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

// 移动端底部 Tab 可见项（顺序固定，与桌面端不同：笔记上提、纪念日/健身收进「更多」）
const tabItems = [
  { to: '/', key: 'dashboard', icon: 'i-carbon-dashboard' },
  { to: '/todos', key: 'todos', icon: 'i-carbon-task' },
  { to: '/ledger', key: 'ledger', icon: 'i-carbon-calculator' },
  { to: '/notes', key: 'notes', icon: 'i-carbon-document' }
]

function openPalette() {
  paletteOpen.value = true
}

// 「更多」面板内的搜索：先关面板再唤起命令面板
function onSheetSearch() {
  open.value = false
  openPalette()
}
</script>

<template>
  <div class="relative h-screen bg-bg text-fg overflow-hidden">

    <!-- ============ 桌面端：固定窄侧边栏（>=1024px 显示，<1024px 隐藏） ============ -->
    <aside
      class="sidebar hidden lg:flex flex-col fixed top-0 left-0 z-40 h-screen w-[200px]"
      aria-label="main navigation"
    >
      <!-- 顶部：Logo + 标题（原样保留，已移除无用的窗口控制按钮） -->
      <div class="flex items-center gap-2 px-3 py-3 shrink-0 border-b border-border">
        <img :src="appLogoDataUri" alt="青简" class="w-7 h-7 rounded-lg object-cover shrink-0 ring-1 ring-border/50" />
        <div class="leading-tight min-w-0">
          <div class="font-bold text-[13px] tracking-wide truncate">{{ t('app.name') }}</div>
          <div class="text-[10px] text-fg-faint truncate">{{ t('app.tagline') }}</div>
        </div>
      </div>

      <!-- 导航：图标 + 文字 横向并排，始终显示（要求 2）；激活态保留左侧青色竖条（要求 4） -->
      <nav class="flex flex-col gap-1 flex-1 overflow-y-auto overflow-x-hidden p-2">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          class="nav-item flex items-center gap-2 px-3 py-2 rounded-[10px] text-fg-soft text-[13px]"
          :class="{ 'opacity-60 hover:opacity-100': n.dim }"
          active-class="nav-active"
          :aria-label="t(n.key)"
        >
          <span :class="n.icon" class="text-lg shrink-0" />
          <span class="truncate">{{ t(n.key) }}</span>
        </RouterLink>
      </nav>

      <!-- 底部固定区：快速搜索 + 设置 + 版本号（要求 5，弱灰小字） -->
      <div class="flex flex-col gap-1 shrink-0 p-2 pt-2 border-t border-border">
        <KbdTip :keys="'Ctrl K'" :label="t('kbd.search')">
          <button
            class="side-search flex items-center gap-2 px-3 py-2 text-[13px] text-fg-faint cursor-pointer"
            @click="openPalette"
            :aria-label="t('nav.searchAria')"
          >
            <span class="i-carbon-search text-base shrink-0" />
            <span class="flex-1 text-left truncate">{{ t('nav.search') }}</span>
          </button>
        </KbdTip>

        <RouterLink
          to="/settings"
          class="side-entry flex items-center gap-2 px-3 py-2 rounded-[10px] text-[13px] text-fg-faint"
          active-class="nav-active"
          :aria-label="t('nav.settings')"
        >
          <span class="i-carbon-settings text-base shrink-0" />
          <span>{{ t('nav.settings') }}</span>
        </RouterLink>

        <div class="px-3 pt-2 pb-1 mt-1 text-[11px] text-fg-faint flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block shrink-0" />
          <span class="truncate leading-none">{{ t('app.version') }}</span>
        </div>
      </div>
    </aside>

    <!-- ============ 移动端：底部固定 Tab 导航（<1024px 显示，>=1024px 隐藏） ============ -->
    <nav class="tabbar lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-border"
         :style="{ paddingBottom: 'var(--safe-bottom)' }">
      <div class="flex items-stretch h-[58px] flex-1">
      <RouterLink
        v-for="ti in tabItems"
        :key="ti.to"
        :to="ti.to"
        class="tab-item flex-1 flex flex-col items-center justify-center gap-0.5"
        active-class="tab-active"
        :aria-label="t('nav.' + ti.key)"
      >
        <span :class="ti.icon" class="text-xl" />
        <span class="text-[10px] leading-none">{{ t('nav.' + ti.key) }}</span>
      </RouterLink>
      <!-- 更多：弹出底部 ActionSheet -->
      <button
        class="tab-item flex-1 flex flex-col items-center justify-center gap-0.5"
        :class="{ 'tab-active': open }"
        @click="toggle"
        :aria-label="t('nav.more')"
        :aria-expanded="open ? 'true' : 'false'"
      >
        <span class="i-carbon-overflow-menu text-xl" />
        <span class="text-[10px] leading-none">{{ t('nav.more') }}</span>
      </button>
      </div>
    </nav>

    <!-- 移动端 ActionSheet（更多）：纪念日 / 健身 / 快速搜索 / 设置 -->
    <Transition name="sheet">
      <div v-if="open" class="sheet-mask lg:hidden fixed inset-0 z-50 bg-black/30" @click="toggle">
        <div class="sheet-panel fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border p-3"
             :style="{ paddingBottom: 'calc(var(--safe-bottom) + 28px)' }" @click.stop>
          <div class="sheet-grip" />
          <RouterLink to="/anniversaries" class="sheet-row" @click="toggle">
            <span class="i-carbon-calendar text-lg shrink-0" />
            <span>{{ t('nav.anniversaries') }}</span>
          </RouterLink>
          <RouterLink to="/fitness" class="sheet-row" @click="toggle">
            <span class="i-carbon-run text-lg shrink-0" />
            <span>{{ t('nav.fitness') }}</span>
          </RouterLink>
          <button class="sheet-row" @click="onSheetSearch">
            <span class="i-carbon-search text-lg shrink-0" />
            <span>{{ t('nav.search') }}</span>
          </button>
          <RouterLink to="/settings" class="sheet-row" @click="toggle">
            <span class="i-carbon-settings text-lg shrink-0" />
            <span>{{ t('nav.settings') }}</span>
          </RouterLink>
        </div>
      </div>
    </Transition>

    <!-- 主区：桌面端左移 200px 给侧边栏让位，移动端加底部内边距避开 58px Tab（要求 8），
         顶部加安全区内边距避开系统状态栏（Tauri 移动端 edge-to-edge） -->
    <main
      class="h-screen overflow-hidden p-4 lg:p-5 transition-[margin] duration-200 lg:ml-[200px]"
      :style="{ paddingTop: 'calc(var(--safe-top) + 1rem)', paddingBottom: 'calc(var(--safe-bottom) + 1rem)' }"
    >
      <div class="card h-full flex flex-col overflow-hidden">
        <div class="flex-1 overflow-auto p-4 lg:p-6 pb-24 lg:pb-6">
          <slot />
        </div>
      </div>
    </main>

    <CommandPalette v-model:open="paletteOpen" />
    <ConfirmDialog />
    <ToastHost />

    <!-- 全局悬浮新建按钮：仅当前页面注册了「新建」处理函数时才显示（保证各页入口一致） -->
    <FloatingActionButton
      v-if="handler"
      :aria-label="label || t('common.add')"
      @click="handler && handler()"
    />
  </div>
</template>

<style scoped>
/* 移动端 ActionSheet 遮罩（与全局弹层遮罩统一） */
.sheet-mask {
  background: var(--c-overlay);
}
/* 桌面端侧边栏：干净浅白底，与正文区做微弱区分（要求 7） */
.sidebar {
  background: var(--c-surface);
  border-right: 1px solid var(--c-border);
}

/* 导航项：图标 + 文字 横向并排（要求 2） */
.nav-item {
  position: relative;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.nav-item:hover {
  /* 整行圆角半透明浅青底色，与 .btn-secondary:hover 风格统一（要求 3） */
  background: var(--c-brand-soft);
  color: var(--c-fg);
}
/* 激活态：保留左侧青色竖条指示器 + 文字品牌青（要求 4，保留原 .nav-active::before） */
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
  height: 22px;
  border-radius: 0 4px 4px 0;
  background: var(--c-brand);
  box-shadow: 0 0 8px var(--c-brand-soft);
}
.dark .nav-active {
  color: var(--c-brand);
}

/* 底部入口：快速搜索（简约搜索框，不做成按钮）/ 设置（纯文字行） */
.side-search {
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: transparent;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.side-search:hover {
  border-color: var(--c-brand);
  color: var(--c-fg-soft);
}
.side-entry {
  transition: color 0.15s ease;
}
.side-entry:hover {
  color: var(--c-fg-soft);
}

/* 移动端底部 Tab 栏（要求：图标在上、文字在下，激活态品牌青） */
.tabbar {
  background: var(--c-surface);
}
.tab-item {
  position: relative;
  color: var(--c-fg-faint);
  transition: color 0.15s ease;
}
.tab-item:hover {
  color: var(--c-fg-soft);
}
.tab-active {
  color: var(--c-brand);
  font-weight: 600;
}
/* 激活态顶部品牌指示条（类比桌面端左侧竖条，让移动端选中态更醒目） */
.tab-active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--c-brand);
}
.dark .tab-active {
  color: var(--c-brand);
}

/* 移动端 ActionSheet */
.sheet-panel {
  background: var(--c-surface);
}
.sheet-grip {
  width: 36px;
  height: 4px;
  border-radius: 9999px;
  background: var(--c-border);
  margin: 0 auto 10px;
}
.sheet-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  color: var(--c-fg-soft);
  font-size: 14px;
  text-align: left;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.sheet-row:hover {
  background: var(--c-brand-soft);
  color: var(--c-fg);
}

/* ActionSheet 过渡：遮罩淡入 + 面板从底部滑上 */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.18s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-panel {
  transition: transform 0.2s ease;
}
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}

/* 移动端 FAB 上移 74px，避开 58px 底部 Tab 栏（要求 5） */
@media (max-width: 1023px) {
  :deep(.fab) {
    bottom: 74px;
  }
}
</style>
