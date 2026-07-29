<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const router = useRouter()
const q = ref('')

const items = [
  { title: '仪表盘', to: '/' },
  { title: '笔记', to: '/notes' },
  { title: '待办', to: '/todos' },
  { title: 'AI 助手', to: '/ai' },
  { title: '设置', to: '/settings' }
]

const filtered = ref(items)

watch(q, (v) => {
  filtered.value = items.filter((i) => i.title.includes(v))
})

function go(to: string) {
  router.push(to)
  emit('update:open', false)
  q.value = ''
}

// 全局快捷键 ⌘K / Ctrl+K
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    emit('update:open', true)
  }
})
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 grid place-items-start pt-32 bg-black/30"
    @click.self="emit('update:open', false)"
  >
    <div class="w-[520px] max-w-[90vw] rounded-xl border border-border bg-bg-soft shadow-xl overflow-hidden">
      <input
        v-model="q"
        autofocus
        placeholder="输入以跳转…"
        class="w-full px-4 py-3 outline-none bg-transparent border-b border-border"
      />
      <ul class="max-h-72 overflow-auto py-1">
        <li
          v-for="i in filtered"
          :key="i.to"
          @click="go(i.to)"
          class="px-4 py-2 hover:bg-brand-soft/40 cursor-pointer"
        >
          {{ i.title }}
        </li>
      </ul>
    </div>
  </div>
</template>
