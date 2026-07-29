import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { TodoRecord, TodoPriority } from '@/types'
import { DAILY_CATEGORY } from '@/types'

/**
 * 待办 Store（分类版）
 * - 预设分类：每日 / 生活 / 工作 / 学习 / 游戏，支持自定义追加
 * - 「每日」分类为循环任务：完成状态按日期记录（doneDates），每天自动重置
 * - localStorage 持久化；M4 统一切换为 StorageAdapter（SQLite / Dexie）
 */
const STORAGE_KEY = 'qingjian.todos'
const CATEGORY_KEY = 'qingjian.todo-categories'

export const PRESET_CATEGORIES = [DAILY_CATEGORY, '生活', '工作', '学习', '游戏']

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 }

/** 本地时区 YYYY-MM-DD */
export function dateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return dateKey(d)
}

function loadTodos(): TodoRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? (JSON.parse(raw) as TodoRecord[]) : []
    // 迁移旧数据：无 category 的历史任务归入「生活」
    for (const t of list) {
      if (!t.category) t.category = '生活'
      if (t.category === DAILY_CATEGORY && !t.doneDates) t.doneDates = []
    }
    return list
  } catch {
    return []
  }
}

function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORY_KEY)
    const list = raw ? (JSON.parse(raw) as string[]) : []
    // 预设分类始终在前且不可缺失
    return [...PRESET_CATEGORIES, ...list.filter((c) => !PRESET_CATEGORIES.includes(c))]
  } catch {
    return [...PRESET_CATEGORIES]
  }
}

export const useTodoStore = defineStore('todos', () => {
  const todos = ref<TodoRecord[]>(loadTodos())
  const categories = ref<string[]>(loadCategories())

  watch(todos, (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)), { deep: true })
  watch(
    categories,
    (v) =>
      localStorage.setItem(
        CATEGORY_KEY,
        JSON.stringify(v.filter((c) => !PRESET_CATEGORIES.includes(c)))
      ),
    { deep: true }
  )

  /* ---------- 完成态（每日任务按“今天”判定） ---------- */

  function isDone(t: TodoRecord, day = dateKey()): boolean {
    if (t.category === DAILY_CATEGORY) return (t.doneDates ?? []).includes(day)
    return t.done
  }

  /** 某分类的任务列表：未完成在前（按优先级→创建时间），已完成殿后 */
  function byCategory(cat: string): TodoRecord[] {
    return todos.value
      .filter((t) => t.category === cat)
      .sort((a, b) => {
        const da = isDone(a) ? 1 : 0
        const db = isDone(b) ? 1 : 0
        return (
          da - db ||
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          b.createdAt - a.createdAt
        )
      })
  }

  /** 分类进度 { done, total, rate } */
  function categoryProgress(cat: string) {
    const list = todos.value.filter((t) => t.category === cat)
    const done = list.filter((t) => isDone(t)).length
    return { done, total: list.length, rate: list.length ? Math.round((done / list.length) * 100) : 0 }
  }

  /** 昨日未完成的每日任务数（任务需在昨天前创建才计入） */
  const yesterdayMissed = computed(() => {
    const yk = yesterdayKey()
    const endOfYesterday = new Date()
    endOfYesterday.setHours(0, 0, 0, 0) // 今天 0 点 = 昨天结束
    return todos.value.filter(
      (t) =>
        t.category === DAILY_CATEGORY &&
        t.createdAt < endOfYesterday.getTime() &&
        !(t.doneDates ?? []).includes(yk)
    ).length
  })

  /** 每日任务连续打卡天数（含今天，若今天未完成则从昨天起算） */
  function streak(t: TodoRecord): number {
    if (t.category !== DAILY_CATEGORY) return 0
    const set = new Set(t.doneDates ?? [])
    let n = 0
    const d = new Date()
    if (!set.has(dateKey(d))) d.setDate(d.getDate() - 1) // 今天没做，从昨天回溯
    while (set.has(dateKey(d))) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  }

  /** 全部未完成（每日按今天判定），按优先级排序 —— 供仪表盘使用 */
  const pending = computed(() =>
    todos.value
      .filter((t) => !isDone(t))
      .sort((a, b) => {
        // 每日任务优先展示
        const ca = a.category === DAILY_CATEGORY ? 0 : 1
        const cb = b.category === DAILY_CATEGORY ? 0 : 1
        return (
          ca - cb ||
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          b.createdAt - a.createdAt
        )
      })
  )

  const doneCount = computed(() => todos.value.filter((t) => isDone(t)).length)

  /** 某天完成的任务数（每日任务查 doneDates，普通任务查 completedAt） */
  function completedCountOn(day: string): number {
    return todos.value.filter((t) => {
      if (t.category === DAILY_CATEGORY) return (t.doneDates ?? []).includes(day)
      if (!t.done || !t.completedAt) return false
      return dateKey(new Date(t.completedAt)) === day
    }).length
  }

  const usedTags = computed(
    () => [...new Set(todos.value.map((t) => t.tag).filter(Boolean))] as string[]
  )

  /* ---------- 动作 ---------- */

  function add(title: string, priority: TodoPriority = 'medium', tag?: string, category = DAILY_CATEGORY) {
    const t = title.trim()
    if (!t) return
    todos.value.unshift({
      id: crypto.randomUUID(),
      title: t,
      done: false,
      priority,
      tag: tag?.trim() || undefined,
      category,
      doneDates: category === DAILY_CATEGORY ? [] : undefined,
      createdAt: Date.now()
    })
  }

  function toggle(id: string) {
    const t = todos.value.find((t) => t.id === id)
    if (!t) return
    if (t.category === DAILY_CATEGORY) {
      const today = dateKey()
      const dates = (t.doneDates ??= [])
      const i = dates.indexOf(today)
      i >= 0 ? dates.splice(i, 1) : dates.push(today)
    } else {
      t.done = !t.done
      t.completedAt = t.done ? Date.now() : undefined
    }
  }

  function remove(id: string) {
    todos.value = todos.value.filter((t) => t.id !== id)
  }

  /** 新增自定义分类；返回是否成功 */
  function addCategory(name: string): boolean {
    const n = name.trim()
    if (!n || n.length > 8 || categories.value.includes(n)) return false
    categories.value.push(n)
    return true
  }

  /** 删除自定义分类（预设不可删），该分类任务移入「生活」 */
  function removeCategory(name: string) {
    if (PRESET_CATEGORIES.includes(name)) return
    categories.value = categories.value.filter((c) => c !== name)
    todos.value.forEach((t) => {
      if (t.category === name) t.category = '生活'
    })
  }

  return {
    todos,
    categories,
    pending,
    doneCount,
    usedTags,
    yesterdayMissed,
    isDone,
    byCategory,
    categoryProgress,
    completedCountOn,
    streak,
    add,
    toggle,
    remove,
    addCategory,
    removeCategory
  }
})
