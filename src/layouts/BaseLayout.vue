<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import CommandPalette from '@/components/CommandPalette.vue'

const route = useRoute()
const paletteOpen = ref(false)

const nav = [
  { to: '/', label: '仪表盘', icon: 'i-carbon-dashboard' },
  { to: '/notes', label: '笔记', icon: 'i-carbon-document' },
  { to: '/todos', label: '待办', icon: 'i-carbon-task' },
  { to: '/ai', label: 'AI 助手', icon: 'i-carbon-ai-status' },
  { to: '/settings', label: '设置', icon: 'i-carbon-settings' }
]

function openPalette() {
  paletteOpen.value = true
}
</script>

<template>
  <div class="flex h-screen bg-bg text-fg">
    <aside class="w-56 border-r border-border bg-bg-soft p-4 flex flex-col">
      <div class="text-lg font-bold mb-6 flex items-center gap-2">
        <span class="w-7 h-7 rounded bg-brand text-white grid place-items-center text-sm">青</span>
        青简
      </div>
      <nav class="flex flex-col gap-1">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          class="flex items-center gap-2 px-3 py-2 rounded hover:bg-brand-soft/40"
          active-class="bg-brand-soft/60 text-brand font-medium"
        >
          <span :class="n.icon" />
          <span>{{ n.label }}</span>
        </RouterLink>
      </nav>
      <button
        class="mt-auto flex items-center gap-2 px-3 py-2 rounded border border-border text-fg-soft hover:bg-brand-soft/40"
        @click="openPalette"
      >
        <span class="i-carbon-search" />
        搜索
        <kbd class="ml-auto text-xs">⌘K</kbd>
      </button>
    </aside>

    <main class="flex-1 overflow-auto">
      <header class="h-12 border-b border-border px-5 flex items-center text-fg-soft">
        {{ route.meta.title || '青简' }}
      </header>
      <div class="p-5">
        <slot />
      </div>
    </main>

    <CommandPalette v-model:open="paletteOpen" />
  </div>
</template>
