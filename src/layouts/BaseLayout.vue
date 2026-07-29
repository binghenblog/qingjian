<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import CommandPalette from '@/components/CommandPalette.vue'

const route = useRoute()
const paletteOpen = ref(false)

const nav = [
  { to: '/', label: '今日桌面', icon: 'i-carbon-dashboard' },
  { to: '/notes', label: '笔记', icon: 'i-carbon-document' },
  { to: '/todos', label: '待办', icon: 'i-carbon-task' },
  { to: '/ai', label: 'AI 助手', icon: 'i-carbon-ai-status' }
]

function openPalette() {
  paletteOpen.value = true
}
</script>

<template>
  <div class="flex h-screen bg-bg text-fg">
    <!-- 侧边栏 -->
    <aside class="w-52 p-4 flex flex-col shrink-0 border-r border-border">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-1 py-2 mb-6">
        <span class="logo-mark w-9 h-9 rounded-xl text-white grid place-items-center text-base font-bold shrink-0">青</span>
        <div class="leading-tight">
          <div class="font-bold text-base tracking-wide">青简</div>
          <div class="text-[11px] text-fg-faint">个人工作台</div>
        </div>
      </div>

      <!-- 导航 -->
      <nav class="flex flex-col gap-1">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          class="nav-item flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-fg-soft"
          active-class="nav-active"
        >
          <span :class="n.icon" class="text-lg shrink-0" />
          <span>{{ n.label }}</span>
        </RouterLink>
      </nav>

      <!-- 底部：搜索入口 + 设置 -->
      <div class="mt-auto flex flex-col gap-2">
        <button
          class="search-trigger flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-fg-faint cursor-pointer"
          @click="openPalette"
        >
          <span class="i-carbon-search text-base" />
          <span>快速搜索</span>
          <kbd class="ml-auto">⌘K</kbd>
        </button>

        <RouterLink
          to="/settings"
          class="nav-item flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-fg-soft"
          active-class="nav-active"
        >
          <span class="i-carbon-settings text-lg shrink-0" />
          <span>设置</span>
        </RouterLink>

        <div class="px-3 py-1.5 text-[11px] text-fg-faint flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
          v0.1.0 · M0
        </div>
      </div>
    </aside>

    <!-- 主区 -->
    <main class="flex-1 overflow-hidden p-5">
      <div class="card h-full flex flex-col overflow-hidden">
        <header class="h-14 px-6 flex items-center justify-between border-b border-border shrink-0">
          <span class="font-semibold">{{ route.meta.title || '青简' }}</span>
          <span class="text-xs text-fg-faint">本地优先 · 数据在你手中</span>
        </header>
        <div class="flex-1 overflow-auto p-6">
          <slot />
        </div>
      </div>
    </main>

    <CommandPalette v-model:open="paletteOpen" />
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
