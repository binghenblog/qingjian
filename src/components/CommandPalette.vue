<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const router = useRouter()
const q = ref('')
const inputEl = ref<HTMLInputElement>()
const activeIdx = ref(0)

const items = [
  { title: '仪表盘', to: '/', icon: 'i-carbon-dashboard' },
  { title: '笔记', to: '/notes', icon: 'i-carbon-document' },
  { title: '待办', to: '/todos', icon: 'i-carbon-task' },
  { title: 'AI 助手', to: '/ai', icon: 'i-carbon-ai-status' },
  { title: '设置', to: '/settings', icon: 'i-carbon-settings' }
]

const filtered = ref(items)

watch(q, (v) => {
  filtered.value = items.filter((i) => i.title.includes(v))
  activeIdx.value = 0
})

watch(
  () => props.open,
  async (v) => {
    if (v) {
      q.value = ''
      filtered.value = items
      activeIdx.value = 0
      await nextTick()
      inputEl.value?.focus()
    }
  }
)

function go(to: string) {
  router.push(to)
  emit('update:open', false)
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    emit('update:open', !props.open)
    return
  }
  if (!props.open) return
  if (e.key === 'Escape') emit('update:open', false)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = (activeIdx.value + 1) % filtered.value.length
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = (activeIdx.value - 1 + filtered.value.length) % filtered.value.length
  }
  if (e.key === 'Enter' && filtered.value[activeIdx.value]) {
    go(filtered.value[activeIdx.value].to)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="open"
        class="palette-mask fixed inset-0 z-50 grid place-items-start justify-center pt-28"
        @click.self="emit('update:open', false)"
      >
        <div class="palette w-[560px] max-w-[92vw] rounded-2xl overflow-hidden">
          <div class="flex items-center gap-2.5 px-4 border-b border-border">
            <span class="i-carbon-search text-fg-faint" />
            <input
              ref="inputEl"
              v-model="q"
              placeholder="搜索页面、命令…"
              class="flex-1 py-3.5 outline-none bg-transparent text-fg placeholder:text-fg-faint"
            />
            <kbd>ESC</kbd>
          </div>
          <ul class="max-h-80 overflow-auto p-1.5 m-0 list-none">
            <li
              v-for="(i, idx) in filtered"
              :key="i.to"
              @click="go(i.to)"
              @mousemove="activeIdx = idx"
              class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer text-sm"
              :class="idx === activeIdx ? 'item-active' : 'text-fg-soft'"
            >
              <span :class="i.icon" class="text-base" />
              <span>{{ i.title }}</span>
              <span v-if="idx === activeIdx" class="ml-auto text-xs text-fg-faint">↵</span>
            </li>
            <li v-if="filtered.length === 0" class="px-3 py-6 text-center text-sm text-fg-faint">
              没有匹配的结果
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-mask {
  background: rgba(10, 14, 20, 0.4);
  backdrop-filter: blur(4px);
}
.palette {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow-lg);
}
.item-active {
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
}
.dark .item-active {
  color: var(--c-brand);
}
</style>
