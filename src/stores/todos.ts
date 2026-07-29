import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { TodoRecord, TodoPriority } from '@/types'

/**
 * 待办 Store
 * M0：localStorage 持久化（刷新不丢）
 * M1：TODO 切换为 StorageAdapter（SQLite / Dexie）
 */
const STORAGE_KEY = 'qingjian.todos'

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 }

function load(): TodoRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TodoRecord[]) : []
  } catch {
    return []
  }
}

export const useTodoStore = defineStore('todos', () => {
  const todos = ref<TodoRecord[]>(load())

  watch(
    todos,
    (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)),
    { deep: true }
  )

  /** 未完成，按 优先级 → 创建时间 排序 */
  const pending = computed(() =>
    todos.value
      .filter((t) => !t.done)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.createdAt - a.createdAt)
  )
  const doneCount = computed(() => todos.value.filter((t) => t.done).length)
  /** 所有已使用过的标签（供输入联想） */
  const usedTags = computed(() => [...new Set(todos.value.map((t) => t.tag).filter(Boolean))] as string[])

  function add(title: string, priority: TodoPriority = 'medium', tag?: string) {
    const t = title.trim()
    if (!t) return
    todos.value.unshift({
      id: crypto.randomUUID(),
      title: t,
      done: false,
      priority,
      tag: tag?.trim() || undefined,
      createdAt: Date.now()
    })
  }

  function toggle(id: string) {
    const t = todos.value.find((t) => t.id === id)
    if (t) t.done = !t.done
  }

  function remove(id: string) {
    todos.value = todos.value.filter((t) => t.id !== id)
  }

  return { todos, pending, doneCount, usedTags, add, toggle, remove }
})
