import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TodoRecord, TodoPriority } from '@/types'
import { DAILY_CATEGORY } from '@/types'
import { todoRepository, todoCategoryRepository, isStorageAvailable } from '@/db'
import { le } from '@/i18n/errors'

/**
 * 待办 Store（分类版）
 * - 预设分类：每日 / 生活 / 工作 / 学习 / 游戏，支持自定义追加
 * - 「每日」分类为循环任务：完成状态按日期记录（doneDates），每天自动重置
 * - 持久化统一经由数据访问层（src/db）：待办存 todos 表、分类存 todoCategories 表
 *   （早期版本曾直接用裸 localStorage，自 v0.6 起迁入 DAL，详见 db/index.ts）
 *
 * 与笔记等模块保持一致：store 初始化时内存态为空，由 `load()` 异步从 DAL 载入；
 * `main.ts` 已在挂载前预加载，组件可同步读取 `todos` 而无需等待。
 */
export const TODOS_VERSION = 2

/** 逐版本迁移链：schema 每次变更就追加一个 from→from+1 的迁移函数。
 * v1 → v2：补 category（历史任务归「生活」）、每日任务补 doneDates */
const MIGRATIONS: Record<number, (list: TodoRecord[]) => TodoRecord[]> = {
  1: (list) =>
    list.map((t) => ({
      ...t,
      category: t.category || '生活',
      doneDates:
        (t.category || '生活') === DAILY_CATEGORY && !Array.isArray(t.doneDates) ? [] : t.doneDates
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
 * 以正午为锚点创建 Date，规避春令时「当天不存在 00:00」的边界。
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

/** 距今 n 天前的 YYYY-MM-DD（纯日历运算，DST 安全） */
export function dateKeyDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateKey(d)
}

/** 剥离 Vue 响应式 Proxy，避免 IndexedDB 结构化克隆失败 */
function toPlain(t: TodoRecord): TodoRecord {
  return { ...t, doneDates: t.doneDates ? [...t.doneDates] : t.doneDates }
}

export const useTodoStore = defineStore('todos', () => {
  const todos = ref<TodoRecord[]>([])
  const categories = ref<string[]>([...PRESET_CATEGORIES])
  const loaded = ref(false)
  /** 加载失败信息（IndexedDB 不可用等），供 UI 降级提示而非白屏 */
  const loadError = ref<string | null>(null)

  async function load() {
    if (loaded.value || loadError.value) return
    if (!isStorageAvailable()) {
      loadError.value = le('errors.idbDisabled')
      return
    }
    try {
      let list = await todoRepository.list()
      // 首次迁移：Dexie 为空且旧 localStorage 有数据 → 迁入并写回 DAL（审查 M-4）
      if (list.length === 0) {
        const migrated = migrateFromLocalStorage()
        if (migrated.todos.length) {
          await todoRepository.saveMany(migrated.todos)
          list = migrated.todos
        }
        if (migrated.categories.length) await todoCategoryRepository.save(migrated.categories)
      }
      todos.value = list
      categories.value = await loadCategories()
      loaded.value = true
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : le('errors.idbReadFailed')
    }
  }

  /** 强制重新加载（备份导入 / 外部变更后刷新内存态，避免 UI 显示旧数据） */
  async function reload() {
    loaded.value = false
    loadError.value = null
    await load()
  }

  /** 从旧 localStorage 迁出待办及其分类（仅首次运行一次） */
  function migrateFromLocalStorage(): { todos: TodoRecord[]; categories: string[] } {
    try {
      const raw = localStorage.getItem('qingjian.todos')
      if (!raw) return { todos: [], categories: [] }
      const list = JSON.parse(raw) as TodoRecord[]
      if (!Array.isArray(list)) return { todos: [], categories: [] }
      const stored = Number(localStorage.getItem('qingjian.todos-version')) || 1
      const migrated = stored >= TODOS_VERSION ? list : migrateTodos(list, stored)
      const catRaw = localStorage.getItem('qingjian.todo-categories')
      const categories = catRaw ? (JSON.parse(catRaw) as string[]) : []
      // 迁移完成即清掉旧键，避免重复卷入
      localStorage.removeItem('qingjian.todos')
      localStorage.removeItem('qingjian.todos-version')
      localStorage.removeItem('qingjian.todo-categories')
      return { todos: migrated, categories }
    } catch (e) {
      console.error('[todos] 从 localStorage 迁移失败', e)
      return { todos: [], categories: [] }
    }
  }

  async function loadCategories(): Promise<string[]> {
    const items = await todoCategoryRepository.list()
    return [...PRESET_CATEGORIES, ...items.filter((c) => !PRESET_CATEGORIES.includes(c))]
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

  /** 分类进度缓存：todos 变化时一次性算好各分类 { done, total, rate } */
  const progressCache = computed(() => {
    const map: Record<string, { done: number; total: number; rate: number }> = {}
    for (const cat of categories.value) {
      const list = todos.value.filter((t) => t.category === cat)
      const done = list.filter((t) => isDone(t)).length
      map[cat] = {
        done,
        total: list.length,
        rate: list.length ? Math.round((done / list.length) * 100) : 0
      }
    }
    return map
  })

  /** 取某分类进度（来自缓存） */
  function categoryProgress(cat: string) {
    return progressCache.value[cat] ?? { done: 0, total: 0, rate: 0 }
  }

  /** 昨日未完成的每日任务数（任务需在昨天前创建才计入） */
  const yesterdayMissed = computed(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yk = prevDayKey(dateKey(now))
    return todos.value.filter(
      (t) =>
        t.category === DAILY_CATEGORY &&
        t.createdAt < startOfToday &&
        !(t.doneDates ?? []).includes(yk)
    ).length
  })

  /** 每日任务连续打卡缓存表 id → 天数 */
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

  /** 日程分组（v0.3.0）：非每日、未完成、有截止日的任务，按 逾期 / 今日 / 即将到期 分组 */
  const agenda = computed(() => {
    const todayK = dateKey()
    const g: { overdue: TodoRecord[]; today: TodoRecord[]; upcoming: TodoRecord[] } = {
      overdue: [],
      today: [],
      upcoming: []
    }
    for (const t of todos.value) {
      if (t.category === DAILY_CATEGORY || t.done || !t.dueDate) continue
      if (t.dueDate < todayK) g.overdue.push(t)
      else if (t.dueDate === todayK) g.today.push(t)
      else g.upcoming.push(t)
    }
    const byDateAsc = (a: TodoRecord, b: TodoRecord) => (a.dueDate! < b.dueDate! ? -1 : 1)
    g.overdue.sort(byDateAsc)
    g.today.sort(byDateAsc)
    g.upcoming.sort(byDateAsc)
    return g
  })

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

  function add(
    title: string,
    priority: TodoPriority = 'medium',
    tag?: string,
    category = DAILY_CATEGORY,
    dueDate?: string
  ) {
    const t = title.trim()
    if (!t) return
    const todo: TodoRecord = {
      id: crypto.randomUUID(),
      title: t,
      done: false,
      priority,
      tag: tag?.trim() || undefined,
      category,
      dueDate,
      doneDates: category === DAILY_CATEGORY ? [] : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    todos.value.unshift(todo)
    // 立即落盘（DAL 已做事务/回滚保障），无需防抖：单条写入足够快
    void todoRepository.save(toPlain(todo)).catch((e) => console.error('[todos] 保存失败', e))
  }

  /** 设置 / 清除任务截止日（v0.3.0 日程合并） */
  function setDueDate(id: string, date?: string) {
    const t = todos.value.find((x) => x.id === id)
    if (!t) return
    t.dueDate = date || undefined
    void todoRepository.save(toPlain(t)).catch(() => {})
  }

  function toggle(id: string) {
    const t = todos.value.find((x) => x.id === id)
    if (!t) return
    if (t.category === DAILY_CATEGORY) {
      const today = dateKey()
      const dates = (t.doneDates ??= [])
      const i = dates.indexOf(today)
      if (i >= 0) {
        dates.splice(i, 1)
      } else {
        dates.push(today)
        // 裁剪：长期使用的每日任务 doneDates 会无限增长，仅保留最近 365 天
        const cutoff = dateKeyDaysAgo(365)
        if (dates.length > 365) t.doneDates = dates.filter((d) => d >= cutoff)
      }
    } else {
      t.done = !t.done
      t.completedAt = t.done ? Date.now() : undefined
    }
    t.updatedAt = Date.now()
    void todoRepository.save(toPlain(t)).catch(() => {})
  }

  function remove(id: string) {
    const t = todos.value.find((x) => x.id === id)
    if (!t) return
    todos.value = todos.value.filter((x) => x.id !== id)
    void todoRepository.delete(id).catch(() => {})
  }

  /** 仅持久化「自定义分类」部分（预设分类在读取时由 DAL 补充在前） */
  function persistCategories() {
    const custom = categories.value.filter((c) => !PRESET_CATEGORIES.includes(c))
    void todoCategoryRepository.save(custom).catch(() => {})
  }

  /** 新增自定义分类；返回是否成功 */
  function addCategory(name: string): boolean {
    const n = name.trim()
    if (!n || n.length > 8 || categories.value.includes(n)) return false
    categories.value.push(n)
    persistCategories()
    return true
  }

  /** 删除自定义分类（预设不可删），该分类任务移入「生活」 */
  function removeCategory(name: string) {
    if (PRESET_CATEGORIES.includes(name)) return
    categories.value = categories.value.filter((c) => c !== name)
    todos.value.forEach((t) => {
      if (t.category === name) t.category = '生活'
    })
    persistCategories()
  }

  return {
    todos,
    categories,
    loaded,
    loadError,
    pending,
    doneCount,
    usedTags,
    yesterdayMissed,
    agenda,
    isDone,
    byCategory,
    categoryProgress,
    completedCountOn,
    streak,
    streaks,
    load,
    reload,
    add,
    toggle,
    remove,
    setDueDate,
    addCategory,
    removeCategory
  }
})
