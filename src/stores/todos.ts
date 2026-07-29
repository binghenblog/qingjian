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
const VERSION_KEY = 'qingjian.todos-version'

/** 当前待办数据结构版本（审查 H-6：版本化迁移，替代无版本的内联兜底） */
export const TODOS_VERSION = 2

/**
 * 逐版本迁移链：schema 每次变更就追加一个 from→from+1 的迁移函数。
 * v1 → v2：补 category（历史任务归「生活」）、每日任务补 doneDates
 */
const MIGRATIONS: Record<number, (list: TodoRecord[]) => TodoRecord[]> = {
  1: (list) =>
    list.map((t) => ({
      ...t,
      category: t.category || '生活',
      doneDates:
        (t.category || '生活') === DAILY_CATEGORY && !Array.isArray(t.doneDates)
          ? []
          : t.doneDates
    }))
}

function migrateTodos(list: TodoRecord[], fromVersion: number): TodoRecord[] {
  let cur = list
  for (let v = fromVersion; v < TODOS_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (step) cur = step(cur)
  }
  return cur
}

export const PRESET_CATEGORIES = [DAILY_CATEGORY, '生活', '工作', '学习', '游戏']

const PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 }

/** 本地时区 YYYY-MM-DD */
export function dateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 计算给定 YYYY-MM-DD 的前一天（纯日历日运算，DST 安全）。
 * 以正午为锚点创建 Date，规避春令时「当天不存在 00:00」的边界（审查 L-28）。
 */
export function prevDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  dt.setDate(dt.getDate() - 1)
  return dateKey(dt)
}

export function yesterdayKey(): string {
  return prevDayKey(dateKey())
}

function loadTodos(): TodoRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(VERSION_KEY, String(TODOS_VERSION))
      return []
    }
    const list = JSON.parse(raw) as TodoRecord[]
    if (!Array.isArray(list)) return []
    const stored = Number(localStorage.getItem(VERSION_KEY)) || 1
    if (stored >= TODOS_VERSION) return list
    const migrated = migrateTodos(list, stored)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    localStorage.setItem(VERSION_KEY, String(TODOS_VERSION))
    return migrated
  } catch (e) {
    // 加载失败不应静默吞掉：至少记录，便于排查数据损坏（审查 L-35）
    console.error('[todos] 读取本地待办失败', e)
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

  // 持久化防抖 200ms：高频操作（连续勾选/编辑）合并为一次写入（审查 L-7）
  let persistTimer: number | undefined
  watch(
    todos,
    (v) => {
      clearTimeout(persistTimer)
      persistTimer = window.setTimeout(
        () => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)),
        200
      )
    },
    { deep: true }
  )
  watch(
    categories,
    (v) =>
      localStorage.setItem(
        CATEGORY_KEY,
        JSON.stringify(v.filter((c) => !PRESET_CATEGORIES.includes(c)))
      ),
    { deep: true }
  )

  /** 立即同步写入 localStorage，绕过 200ms 防抖，用于页面/窗口关闭前兜底（审查 L-40） */
  function flushNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos.value))
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushNow)
  }

  /** 重新从 localStorage 读取（审查 M-46）：备份导入后刷新内存态，避免 UI 显示旧数据 */
  function reload() {
    todos.value = loadTodos()
    categories.value = loadCategories()
  }

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
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    // 与 startOfToday 同源的单一 now，避免两次 new Date() 跨越午夜导致判定不一致（审查 L-29）
    const yk = prevDayKey(dateKey(now))
    return todos.value.filter(
      (t) =>
        t.category === DAILY_CATEGORY &&
        t.createdAt < startOfToday &&
        !(t.doneDates ?? []).includes(yk)
    ).length
  })

  /** 每日任务连续打卡缓存表 id → 天数（审查 M-15：避免 v-for 每行重复回溯计算） */
  const streaks = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const t of todos.value) {
      if (t.category === DAILY_CATEGORY) map[t.id] = streak(t)
    }
    return map
  })

  /** 每日任务连续打卡天数（含今天，若今天未完成则从昨天起算） */
  function streak(t: TodoRecord): number {
    if (t.category !== DAILY_CATEGORY) return 0
    const set = new Set(t.doneDates ?? [])
    // 纯日历日字符串回溯，杜绝 DST 切换 / 午夜边界导致的日期错位（审查 L-28）
    let key = dateKey()
    if (!set.has(key)) key = prevDayKey(key) // 今天没做，从昨天回溯
    let n = 0
    while (set.has(key)) {
      n++
      key = prevDayKey(key)
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
    streaks,
    reload,
    add,
    toggle,
    remove,
    addCategory,
    removeCategory
  }
})
