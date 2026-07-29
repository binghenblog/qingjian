<script setup lang="ts">
import { ref, computed } from 'vue'

const todos = ref<{ id: string; title: string; done: boolean }[]>([])
const draft = ref('')

const doneCount = computed(() => todos.value.filter((t) => t.done).length)

function add() {
  const t = draft.value.trim()
  if (!t) return
  todos.value.unshift({ id: crypto.randomUUID(), title: t, done: false })
  draft.value = ''
}
function toggle(id: string) {
  const i = todos.value.find((t) => t.id === id)
  if (i) i.done = !i.done
}
function remove(id: string) {
  todos.value = todos.value.filter((t) => t.id !== id)
}
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <div class="flex items-baseline justify-between">
      <h2 class="text-xl font-bold m-0">待办 / 任务</h2>
      <span v-if="todos.length" class="text-sm text-fg-faint">{{ doneCount }} / {{ todos.length }} 已完成</span>
    </div>

    <!-- 输入区 -->
    <div class="flex gap-2.5">
      <input
        v-model="draft"
        @keyup.enter="add"
        placeholder="添加一项待办，回车确认…"
        class="input-modern flex-1 px-4 py-2.5 text-sm"
      />
      <button @click="add" class="btn-primary px-5 py-2.5 text-sm flex items-center gap-1.5">
        <span class="i-carbon-add text-base" />
        添加
      </button>
    </div>

    <!-- 列表 -->
    <TransitionGroup name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
      <li
        v-for="t in todos"
        :key="t.id"
        class="todo-item group flex items-center gap-3 px-4 py-3 rounded-xl"
      >
        <button
          @click="toggle(t.id)"
          class="check w-5 h-5 rounded-full grid place-items-center shrink-0 cursor-pointer"
          :class="t.done ? 'check-done' : ''"
        >
          <span v-if="t.done" class="i-carbon-checkmark text-xs text-white" />
        </button>
        <span class="flex-1 text-sm transition-all" :class="t.done ? 'line-through text-fg-faint' : ''">
          {{ t.title }}
        </span>
        <button
          @click="remove(t.id)"
          class="del opacity-0 group-hover:opacity-100 text-fg-faint hover:text-red-500 cursor-pointer bg-transparent border-none p-1"
        >
          <span class="i-carbon-trash-can text-base" />
        </button>
      </li>
    </TransitionGroup>

    <!-- 空状态 -->
    <div v-if="todos.length === 0" class="empty grid place-items-center py-14 rounded-2xl text-center">
      <div>
        <span class="i-carbon-task-complete text-4xl text-fg-faint" />
        <p class="text-sm text-fg-faint mt-2 mb-0">暂无待办，从上面添加第一项吧</p>
      </div>
    </div>

    <p class="text-xs text-fg-faint">M1 将接入 StorageAdapter 持久化 · 支持清单、优先级、截止日</p>
  </div>
</template>

<style scoped>
.todo-item {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.todo-item:hover {
  border-color: var(--c-brand);
  box-shadow: var(--shadow-sm);
}

.check {
  border: 2px solid var(--c-border);
  background: transparent;
  transition: all 0.15s ease;
}
.check:hover { border-color: var(--c-brand); }
.check-done {
  border-color: var(--c-brand);
  background: var(--c-brand-grad);
}

.del { transition: opacity 0.15s ease, color 0.15s ease; }

.empty {
  border: 1.5px dashed var(--c-border);
}

.list-enter-active, .list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateY(-8px); }
.list-leave-to { opacity: 0; transform: translateX(12px); }
</style>
