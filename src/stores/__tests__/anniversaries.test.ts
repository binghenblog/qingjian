import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAnniversariesStore } from '../anniversaries'
import { anniversaryRepository as anniversaryStorage } from '@/db'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function freshStore() {
  setActivePinia(createPinia())
  return useAnniversariesStore()
}

beforeEach(async () => {
  localStorage.clear()
  await anniversaryStorage.replaceAll([])
})

describe('anniversaries daysUntil', () => {
  it('today → 0', () => {
    const s = freshStore()
    expect(s.daysUntil(ymd(new Date()))).toBe(0)
  })

  it('tomorrow → 1', () => {
    const s = freshStore()
    const t = new Date()
    t.setDate(t.getDate() + 1)
    expect(s.daysUntil(ymd(t))).toBe(1)
  })

  it('已过日期滚动到下一年（>300 天）', () => {
    const s = freshStore()
    const p = new Date()
    p.setDate(p.getDate() - 2)
    expect(s.daysUntil(ymd(p))).toBeGreaterThan(300)
  })
})

describe('anniversaries CRUD 与排序', () => {
  it('新增后列表按距离天数升序（最近的排最前）', async () => {
    const s = freshStore()
    await s.load()
    // 纪念日只看月-日：far 取约 200 天后的月-日（实际年份被忽略）
    const far = new Date()
    far.setDate(far.getDate() + 200)
    const near = new Date()
    near.setDate(near.getDate() + 30)
    const past = new Date()
    past.setDate(past.getDate() - 5)
    await s.add({ name: 'A', date: ymd(far) })
    await s.add({ name: 'B', date: ymd(near) })
    await s.add({ name: 'C', date: ymd(past) })
    expect(s.list.length).toBe(3)
    expect(s.list[0].name).toBe('B')
  })

  it('删除后列表清空', async () => {
    const s = freshStore()
    await s.load()
    await s.add({ name: 'X', date: ymd(new Date()) })
    const id = s.list[0].id
    await s.remove(id)
    expect(s.list.length).toBe(0)
  })
})
