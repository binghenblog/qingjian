import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNoteStore } from '../notes'
import { noteRepository } from '@/db'

function freshStore() {
  setActivePinia(createPinia())
  return useNoteStore()
}

beforeEach(async () => {
  localStorage.clear()
  await noteRepository.replaceAll([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('searchNotes 全文搜索', () => {
  async function seed(store: ReturnType<typeof useNoteStore>) {
    const a = await store.create()
    await store.update(a.id, { title: 'Vue 学习笔记', content: '组合式 API 心得' })
    const b = await store.create()
    await store.update(b.id, { title: '购物清单', content: '牛奶、鸡蛋、Vue 周边贴纸' })
    const c = await store.create()
    await store.update(c.id, { title: '日记', content: '今天天气不错', tags: ['生活', 'vue3'] })
    return { a, b, c }
  }

  it('标题命中优先，其次内容，其次标签；大小写不敏感', async () => {
    const store = freshStore()
    const { a, b, c } = await seed(store)
    const results = store.searchNotes('vue')
    const ids = results.map((r) => r.note.id)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id)
    expect(ids).toContain(c.id)
    expect(results.find((r) => r.note.id === a.id)!.field).toBe('title')
    expect(results.find((r) => r.note.id === b.id)!.field).toBe('content')
    expect(results.find((r) => r.note.id === c.id)!.field).toBe('tag')
  })

  it('内容命中返回上下文摘要片段', async () => {
    const store = freshStore()
    const n = await store.create()
    await store.update(n.id, { content: 'x'.repeat(100) + '目标关键词' + 'y'.repeat(100) })
    const [r] = store.searchNotes('目标关键词')
    expect(r.snippet).toContain('目标关键词')
    expect(r.snippet.length).toBeLessThan(80)
    expect(r.snippet.startsWith('…')).toBe(true)
  })

  it('空查询返回空数组，limit 生效', async () => {
    const store = freshStore()
    await seed(store)
    expect(store.searchNotes('  ')).toEqual([])
    expect(store.searchNotes('笔记', 1)).toHaveLength(1)
  })
})

describe('update 失败回滚（H-4）', () => {
  it('写盘失败时内存态回滚且记录 lastError', async () => {
    const store = freshStore()
    const n = await store.create()
    await store.update(n.id, { title: '原标题', content: '原内容' })

    vi.spyOn(noteRepository, 'save').mockRejectedValueOnce(new Error('磁盘炸了'))
    await expect(store.update(n.id, { title: '新标题' })).rejects.toThrow('磁盘炸了')

    const cur = store.notes.find((x) => x.id === n.id)!
    expect(cur.title).toBe('原标题')
    expect(store.lastError).toContain('磁盘炸了')
  })

  it('写盘成功后清除 lastError', async () => {
    const store = freshStore()
    const n = await store.create()
    vi.spyOn(noteRepository, 'save').mockRejectedValueOnce(new Error('x'))
    await store.update(n.id, { title: 'A' }).catch(() => {})
    await store.update(n.id, { title: 'B' })
    expect(store.lastError).toBeNull()
    expect(store.notes.find((x) => x.id === n.id)!.title).toBe('B')
  })
})

describe('文件夹', () => {
  it('removeFolder 批量把笔记归入未分类', async () => {
    const store = freshStore()
    store.addFolder('工作')
    const n1 = await store.create('工作')
    const n2 = await store.create('工作')
    await store.removeFolder('工作')
    expect(store.folders).not.toContain('工作')
    expect(store.notes.find((x) => x.id === n1.id)!.folder).toBe('')
    const persisted = await noteRepository.list()
    expect(persisted.every((n) => n.folder === '')).toBe(true)
    expect(persisted.map((n) => n.id).sort()).toEqual([n1.id, n2.id].sort())
  })

  it('removeFolder 写盘失败时整体回滚', async () => {
    const store = freshStore()
    store.addFolder('工作')
    await store.create('工作')
    vi.spyOn(noteRepository, 'saveMany').mockRejectedValueOnce(new Error('fail'))
    await expect(store.removeFolder('工作')).rejects.toThrow('fail')
    expect(store.folders).toContain('工作')
    expect(store.notes[0].folder).toBe('工作')
  })

  it('addFolder 去重与空名校验', () => {
    const store = freshStore()
    expect(store.addFolder('甲')).toBe(true)
    expect(store.addFolder('甲')).toBe(false)
    expect(store.addFolder('  ')).toBe(false)
  })
})
