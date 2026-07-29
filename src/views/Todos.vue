<script setup lang="ts">
import { ref } from 'vue'
import { useTodoStore } from '@/stores/todos'
import TodoBadges from '@/components/TodoBadges.vue'
import type { TodoPriority } from '@/types'

const store = useTodoStore()

const draft = ref('')
const draftPriority = ref<TodoPriority>('medium')
const draftTag = ref('')

const priorities: { value: TodoPriority; label: string; dot: string }[] = [
  { value: 'high', label: '高', dot: 'bg-red-500' },
  { value: 'medium', label: '中', dot: 'bg-amber-500' },
  { value: 'low', label: '低', dot: 'bg-slate-400' }
]

function add() {
  if (!draft.value.trim()) return
  store.add(draft.value, draftPriority.value, draftTag.value)
  draft.value = ''
  draftTag.value = ''
}
</script>

<template>
  <div class="space-y-5 max-w-2xl">
    <div class="flex items-baseline justify-between">
      <h2 class="text-xl font-bold m-0">待办 / 任务</h2>
      <span v-if="store.todos.length" class="text-sm text-fg-faint">
        {{ store.doneCount }} / {{ store.todos.length }} 已完成
      </span>
    </div>

    <!-- 输入区 -->
    <div class="composer rounded-2xl p-3 space-y-3">
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
      <div class="flex items-center gap-4 flex-wrap">
        <!-- 优先级标注 -->
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-fg-faint">优先级</span>
          <button
            v-for="p in priorities"
            :key="p.value"
            @click="draftPriority = p.value"
            class="pri-btn flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer"
            :class="draftPriority === p.value ? 'pri-active' : ''"
          >
            <span class="w-1.5 h-1.5 rounded-full inline-block" :class="p.dot" />
            {{ p.label }}
          </button>
        </div>
        <!-- 标签标注 -->
        <div class="flex items-center gap-1.5 flex-1 min-w-40">
          <span class="i-carbon-tag text-fg-faint text-sm shrink-0" />
          <input
            v-model="draftTag"
            @keyup.enter="add"
            list="used-tags"
            placeholder="标签（可选），如：工作 / 学习"
            class="flex-1 text-xs bg-transparent border-none outline-none text-fg placeholder:text-fg-faint py-1"
          />
          <datalist id="used-tags">
            <option v-for="t in store.usedTags" :key="t" :value="t" />
          </datalist>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <TransitionGroup name="list" tag="ul" class="space-y-2 p-0 m-0 list-none">
      <li
        v-for="t in store.todos"
        :key="t.id"
        class="todo-item group flex items-center gap-3 px-4 py-3 rounded-xl"
      >
        <button
          @click="store.toggle(t.id)"
          class="check w-5 h-5 rounded-full grid place-items-center shrink-0 cursor-pointer"
          :class="t.done ? 'check-done' : ''"
        >
          <span v-if="t.done" class="i-carbon-checkmark text-xs text-white" />
        </button>
        <span class="flex-1 text-sm transition-all" :class="t.done ? 'line-through text-fg-faint' : ''">
          {{ t.title }}
        </span>
        <TodoBadges :priority="t.priority" :tag="t.tag" />
        <button
          @click="store.remove(t.id)"
          class="del opacity-0 group-hover:opacity-100 text-fg-faint hover:text-red-500 cursor-pointer bg-transparent border-none p-1"
        >
          <span class="i-carbon-trash-can text-base" />
        </button>
      </li>
    </TransitionGroup>

    <!-- 空状态 -->
    <div v-if="store.todos.length === 0" class="empty grid place-items-center py-14 rounded-2xl text-center">
      <div>
        <span class="i-carbon-task-complete text-4xl text-fg-faint" />
        <p class="text-sm text-fg-faint mt-2 mb-0">暂无待办，从上面添加第一项吧</p>
      </div>
    </div>

    <p class="text-xs text-fg-faint">已启用本地持久化（localStorage）· M1 将升级为 SQLite / Dexie</p>
  </div>
</template>

<style scoped>
.composer {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
}

.pri-btn {
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  color: var(--c-fg-soft);
  transition: all 0.15s ease;
}
.pri-btn:hover { color: var(--c-fg); }
.pri-active {
  border-color: var(--c-brand);
  background: var(--c-brand-soft);
  color: var(--c-brand-strong);
  font-weight: 600;
}
.dark .pri-active { color: var(--c-brand); }

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

.empty { border: 1.5px dashed var(--c-border); }

.list-enter-active, .list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateY(-8px); }
.list-leave-to { opacity: 0; transform: translateX(12px); }
</style>
