<script setup lang="ts">
import { ref } from 'vue'

const todos = ref<{ id: string; title: string; done: boolean }[]>([])
const draft = ref('')

function add() {
  const t = draft.value.trim()
  if (!t) return
  todos.value.push({ id: crypto.randomUUID(), title: t, done: false })
  draft.value = ''
}
function toggle(id: string) {
  const i = todos.value.find((t) => t.id === id)
  if (i) i.done = !i.done
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-xl font-semibold">待办 / 任务</h2>
    <p class="text-sm text-fg-soft">M1 接入 StorageAdapter 持久化；GTD 风格：清单、优先级、截止日、完成态。</p>
    <div class="flex gap-2">
      <input
        v-model="draft"
        @keyup.enter="add"
        placeholder="添加一项待办…"
        class="flex-1 px-3 py-2 rounded border border-border bg-bg-soft outline-none"
      />
      <button @click="add" class="px-4 py-2 rounded bg-brand text-white">添加</button>
    </div>
    <ul class="space-y-1">
      <li v-for="t in todos" :key="t.id" class="flex items-center gap-2 px-3 py-2 rounded border border-border">
        <input type="checkbox" :checked="t.done" @change="toggle(t.id)" />
        <span :class="t.done ? 'line-through text-fg-soft' : ''">{{ t.title }}</span>
      </li>
    </ul>
  </div>
</template>
