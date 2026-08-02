import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useQuotesStore } from '../quotes'
import { quoteStorage } from '@/services/storage'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function freshStore() {
  setActivePinia(createPinia())
  return useQuotesStore()
}

beforeEach(async () => {
  localStorage.clear()
  await quoteStorage.replaceAll([])
})

describe('quotes CRUD 与排序', () => {
  it('新增后列表按日期倒序（最新的排最前）', async () => {
    const s = freshStore()
    await s.load()
    const old = new Date()
    old.setDate(old.getDate() - 10)
    const recent = new Date()
    await s.add({ text: 'old', date: ymd(old) })
    await s.add({ text: 'new', date: ymd(recent) })
    expect(s.list.length).toBe(2)
    expect(s.list[0].text).toBe('new')
  })

  it('删除后列表清空', async () => {
    const s = freshStore()
    await s.load()
    await s.add({ text: 'hello', date: ymd(new Date()) })
    const id = s.list[0].id
    await s.remove(id)
    expect(s.list.length).toBe(0)
  })
})
