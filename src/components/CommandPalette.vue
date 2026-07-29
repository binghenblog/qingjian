<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNoteStore } from '@/stores/notes'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const router = useRouter()
const noteStore = useNoteStore()
const q = ref('')
const inputEl = ref<HTMLInputElement>()
const activeIdx = ref(0)
/** 打开前聚焦的元素，关闭后恢复（审查 H-10 焦点陷阱） */
const prevFocus = ref<HTMLElement | null>(null)

const pages = [
  { title: '仪表盘', to: '/', icon: 'i-carbon-dashboard' },
  { title: '笔记', to: '/notes', icon: 'i-carbon-document' },
  { title: '待办', to: '/todos', icon: 'i-carbon-task' },
  { title: 'AI 助手', to: '/ai', icon: 'i-carbon-ai-status' },
  { title: '设置', to: '/settings', icon: 'i-carbon-settings' }
]

interface PaletteItem {
  kind: 'page' | 'note'
  title: string
  icon: string
  /** page: 路由；note: 笔记 id */
  target: string
  hint?: string
}

/** 页面项 + 笔记全文搜索结果（最多 8 条） */
const items = computed<PaletteItem[]>(() => {
  const query = q.value.trim()
  const pageItems: PaletteItem[] = pages
    .filter((p) => !query || p.title.includes(query))
    .map((p) => ({ kind: 'page', title: p.title, icon: p.icon, target: p.to }))
  if (!query) return pageItems
  const noteItems: PaletteItem[] = noteStore.searchNotes(query, 8).map((r) => ({
    kind: 'note',
    title: r.note.title || '无标题笔记',
    icon: 'i-carbon-document',
    target: r.note.id,
    hint: r.field === 'title' ? (r.note.folder || '笔记') : r.snippet
  }))
  return [...pageItems, ...noteItems]
})

watch(q, () => (activeIdx.value = 0))

watch(
  () => props.open,
  async (v) => {
    if (v) {
      prevFocus.value = document.activeElement as HTMLElement
      q.value = ''
      activeIdx.value = 0
      // 确保笔记已加载（首次直接打开面板搜索的场景）
      if (!noteStore.loaded) noteStore.load()
      await nextTick()
      inputEl.value?.focus()
    } else {
      // 关闭后焦点回到触发元素（审查 H-10）
      prevFocus.value?.focus()
    }
  }
)

function go(item: PaletteItem) {
  if (item.kind === 'page') {
    router.push(item.target)
  } else {
    noteStore.select(item.target)
    router.push('/notes')
  }
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
  // 焦点陷阱（审查 H-10）：面板打开时 Tab 不离开，焦点始终回到输入框
  if (e.key === 'Tab') {
    e.preventDefault()
    inputEl.value?.focus()
    return
  }
  const len = items.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (len > 0) activeIdx.value = (activeIdx.value + 1) % len
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (len > 0) activeIdx.value = (activeIdx.value - 1 + len) % len
  }
  if (e.key === 'Enter' && items.value[activeIdx.value]) {
    go(items.value[activeIdx.value])
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
              placeholder="搜索页面、笔记全文…"
              class="flex-1 py-3.5 outline-none bg-transparent text-fg placeholder:text-fg-faint"
            />
            <kbd>ESC</kbd>
          </div>
          <ul class="max-h-80 overflow-auto p-1.5 m-0 list-none">
            <li
              v-for="(i, idx) in items"
              :key="i.kind + i.target"
              @click="go(i)"
              @mousemove="activeIdx = idx"
              class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer text-sm"
              :class="idx === activeIdx ? 'item-active' : 'text-fg-soft'"
            >
              <span :class="i.icon" class="text-base shrink-0" />
              <span class="shrink-0">{{ i.title }}</span>
              <span v-if="i.hint" class="hint text-xs text-fg-faint truncate flex-1">{{ i.hint }}</span>
              <span v-if="i.kind === 'note'" class="kind-badge shrink-0">笔记</span>
              <span v-if="idx === activeIdx" class="ml-auto text-xs text-fg-faint shrink-0">↵</span>
            </li>
            <li v-if="items.length === 0" class="px-3 py-6 text-center text-sm text-fg-faint">
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
.kind-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-faint);
}
.hint { min-width: 0; }
</style>
