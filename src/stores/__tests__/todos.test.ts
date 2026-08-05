import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTodoStore, dateKey, yesterdayKey, TODOS_VERSION } from '../todos'
import { todoRepository, todoCategoryRepository } from '@/db'
import { DAILY_CATEGORY } from '@/types'

const STORAGE_KEY = 'qingjian.todos'
const VERSION_KEY = 'qingjian.todos-version'

function freshStore() {
  setActivePinia(createPinia())
  return useTodoStore()
}

beforeEach(async () => {
  localStorage.clear()
  await todoRepository.replaceAll([])
  await todoCategoryRepository.clear()
})

describe('dateKey / yesterdayKey', () => {
  it('生成本地时区 YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('yesterdayKey 是今天的前一天', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(yesterdayKey()).toBe(dateKey(d))
  })
})

describe('版本化迁移（H-6 / M-4：从裸 localStorage 迁入 DAL）', () => {
  it('v1 数据（无版本号）自动补 category 与 doneDates，并落盘到 Dexie', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a', title: '旧任务', done: false, priority: 'medium', createdAt: 1 },
        { id: 'b', title: '旧每日', done: false, priority: 'high', category: DAILY_CATEGORY, createdAt: 2 }
      ])
    )
    const store = freshStore()
    await store.load()
    const a = store.todos.find((t) => t.id === 'a')!
    const b = store.todos.find((t) => t.id === 'b')!
    expect(a.category).toBe('生活')
    expect(b.doneDates).toEqual([])
    // 迁移后写入 Dexie，旧 localStorage 键被清理
    expect(await todoRepository.get('a')).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('空库加载后内存态为空且 loaded 置位', async () => {
    const store = freshStore()
    await store.load()
    expect(store.loaded).toBe(true)
    expect(store.todos).toEqual([])
  })

  it('已是当前版本的数据不重复迁移', async () => {
    localStorage.setItem(VERSION_KEY, String(TODOS_VERSION))
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'x', title: 't', done: false, priority: 'low', category: '工作', createdAt: 1 }])
    )
    const store = freshStore()
    await store.load()
    expect(store.todos[0].category).toBe('工作')
  })
})

describe('byCategory 排序', () => {
  it('未完成在前，按优先级 high>medium>low，再按创建时间倒序', () => {
    const store = freshStore()
    store.add('低', 'low', undefined, '工作')
    store.add('高', 'high', undefined, '工作')
    store.add('中', 'medium', undefined, '工作')
    const titles = store.byCategory('工作').map((t) => t.title)
    expect(titles).toEqual(['高', '中', '低'])
  })

  it('已完成任务殿后', () => {
    const store = freshStore()
    store.add('先做', 'high', undefined, '生活')
    store.add('后做', 'low', undefined, '生活')
    const first = store.byCategory('生活')[0]
    store.toggle(first.id)
    expect(store.byCategory('生活')[0].title).toBe('后做')
  })
})

describe('每日任务 streak', () => {
  function daysAgo(n: number) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return dateKey(d)
  }

  it('今天已完成：连续天数含今天', () => {
    const store = freshStore()
    store.add('打卡', 'medium')
    const t = store.todos[0]
    t.doneDates = [daysAgo(0), daysAgo(1), daysAgo(2)]
    expect(store.streak(t)).toBe(3)
  })

  it('今天未完成：从昨天回溯', () => {
    const store = freshStore()
    store.add('打卡', 'medium')
    const t = store.todos[0]
    t.doneDates = [daysAgo(1), daysAgo(2)]
    expect(store.streak(t)).toBe(2)
  })

  it('断签则归零/重计', () => {
    const store = freshStore()
    store.add('打卡', 'medium')
    const t = store.todos[0]
    t.doneDates = [daysAgo(3), daysAgo(4)]
    expect(store.streak(t)).toBe(0)
  })

  it('非每日任务恒为 0', () => {
    const store = freshStore()
    store.add('普通', 'medium', undefined, '生活')
    expect(store.streak(store.todos[0])).toBe(0)
  })
})

describe('toggle', () => {
  it('每日任务按今天日期打卡/撤销', () => {
    const store = freshStore()
    store.add('每日', 'medium')
    const t = store.todos[0]
    store.toggle(t.id)
    expect(t.doneDates).toContain(dateKey())
    expect(store.isDone(t)).toBe(true)
    store.toggle(t.id)
    expect(store.isDone(t)).toBe(false)
  })

  it('普通任务切换 done 并记录 completedAt', () => {
    const store = freshStore()
    store.add('普通', 'medium', undefined, '生活')
    const t = store.todos[0]
    store.toggle(t.id)
    expect(t.done).toBe(true)
    expect(t.completedAt).toBeTypeOf('number')
    store.toggle(t.id)
    expect(t.completedAt).toBeUndefined()
  })
})
